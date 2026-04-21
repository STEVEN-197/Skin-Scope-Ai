from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import cv2
import numpy as np

try:
    import torch
    import torchvision.models as models
    import torchvision.transforms as transforms
except Exception:  # pragma: no cover - optional runtime dependency fallback
    torch = None
    models = None
    transforms = None


@dataclass
class AnalysisResult:
    condition: str
    severity: str
    confidence: float
    observations: str
    trend_analysis: str
    recommendation: str
    color_score: float


class SkinAnalyzer:
    """Hybrid analyzer: CNN feature extraction + HSV/RGB color analysis."""

    REGION_THRESHOLDS = {
        "eye": {"yellow": 0.24, "red": 0.18},
        "skin": {"yellow": 0.28, "red": 0.21},
        "palm": {"yellow": 0.30, "red": 0.24},
    }

    def __init__(self) -> None:
        self.device = "cpu"
        self.feature_extractor = None
        self.transforms = None
        self._init_feature_extractor()

    def _init_feature_extractor(self) -> None:
        if torch is None or models is None or transforms is None:
            return

        try:
            weights = models.MobileNet_V3_Small_Weights.DEFAULT
            model = models.mobilenet_v3_small(weights=weights)
            self.transforms = weights.transforms()
        except Exception:
            # Fallback if pretrained weights cannot be fetched.
            model = models.mobilenet_v3_small(weights=None)
            self.transforms = transforms.Compose(
                [
                    transforms.ToTensor(),
                    transforms.Resize((224, 224), antialias=True),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
                ]
            )

        model.classifier = torch.nn.Identity()
        model.eval()
        self.feature_extractor = model

    def _extract_cnn_signal(self, rgb_image: np.ndarray) -> float:
        """Return a compact signal (0..1) from MobileNet features."""
        if self.feature_extractor is None or self.transforms is None or torch is None:
            return 0.5

        pil_compatible = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        tensor = self.transforms(pil_compatible).unsqueeze(0)
        with torch.no_grad():
            features = self.feature_extractor(tensor)
        feature_strength = torch.sigmoid(features.mean()).item()
        return float(feature_strength)

    def _color_features(self, rgb_image: np.ndarray) -> Dict[str, float]:
        hsv = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2HSV)

        # Jaundice proxy: yellow hue range with moderate-to-high saturation/value.
        yellow_mask = cv2.inRange(hsv, (15, 45, 55), (40, 255, 255))
        yellow_ratio = float(np.mean(yellow_mask > 0))

        # Burn proxy: strong red + dark regions suggest erythema/scalding.
        red_mask1 = cv2.inRange(hsv, (0, 45, 30), (12, 255, 255))
        red_mask2 = cv2.inRange(hsv, (165, 45, 30), (180, 255, 255))
        red_mask = cv2.bitwise_or(red_mask1, red_mask2)
        red_ratio = float(np.mean(red_mask > 0))
        darkness_ratio = float(np.mean(hsv[:, :, 2] < 70))

        return {
            "yellow_ratio": yellow_ratio,
            "red_ratio": red_ratio,
            "dark_ratio": darkness_ratio,
        }

    @staticmethod
    def _severity(score: float) -> str:
        if score < 0.35:
            return "Mild"
        if score < 0.65:
            return "Moderate"
        return "Severe"

    @staticmethod
    def _condition_from_scores(yellow: float, burn: float) -> str:
        if max(yellow, burn) < 0.20:
            return "No strong indicators"
        return "Possible jaundice" if yellow >= burn else "Possible burn"

    def analyze(
        self,
        image_path: Path,
        region: str,
        historical_scores: List[float],
    ) -> AnalysisResult:
        region = region.lower()
        if region not in self.REGION_THRESHOLDS:
            region = "skin"

        bgr = cv2.imread(str(image_path))
        if bgr is None:
            raise ValueError("Unable to read the uploaded image.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_AREA)

        color = self._color_features(rgb)
        cnn_signal = self._extract_cnn_signal(rgb)

        thresholds = self.REGION_THRESHOLDS[region]
        yellow_score = min(1.0, color["yellow_ratio"] / thresholds["yellow"])
        burn_score = min(1.0, (0.7 * color["red_ratio"] + 0.3 * color["dark_ratio"]) / thresholds["red"])

        current_score = float(np.clip(0.45 * max(yellow_score, burn_score) + 0.35 * cnn_signal + 0.20 * abs(yellow_score - burn_score), 0, 1))

        history_avg = float(np.mean(historical_scores)) if historical_scores else current_score
        final_score = float(np.clip(0.70 * current_score + 0.30 * history_avg, 0, 1))

        trend = "Stable baseline"
        if historical_scores:
            delta = current_score - history_avg
            if delta > 0.08:
                trend = "Worsening trend"
            elif delta < -0.08:
                trend = "Improving trend"
            else:
                trend = "Stable trend"

        condition = self._condition_from_scores(yellow_score, burn_score)
        severity = self._severity(final_score)
        confidence = float(np.clip(0.55 + 0.35 * abs(yellow_score - burn_score) + 0.10 * cnn_signal, 0, 0.99))

        observations = (
            f"Region={region}; yellow_ratio={color['yellow_ratio']:.3f}; "
            f"red_ratio={color['red_ratio']:.3f}; dark_ratio={color['dark_ratio']:.3f}; "
            f"cnn_signal={cnn_signal:.3f}; history_samples={len(historical_scores)}"
        )

        if condition == "No strong indicators":
            recommendation = "No acute visual flags detected. Continue monitoring and maintain healthy hydration/sleep patterns."
        elif condition == "Possible jaundice":
            recommendation = "Consider a liver-function and bilirubin screening. If yellowing increases, seek prompt clinical evaluation."
        else:
            recommendation = "Possible burn-related inflammation observed. Keep the area clean and seek care urgently for severe pain/blistering."

        return AnalysisResult(
            condition=condition,
            severity=severity,
            confidence=confidence,
            observations=observations,
            trend_analysis=trend,
            recommendation=recommendation,
            color_score=final_score,
        )
