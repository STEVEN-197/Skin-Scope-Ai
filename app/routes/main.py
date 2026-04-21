from __future__ import annotations

from datetime import datetime
from pathlib import Path

from flask import Blueprint, Response, current_app, flash, redirect, render_template, request, send_file, send_from_directory, url_for
from flask_login import current_user, login_required
from fpdf import FPDF
from werkzeug.utils import secure_filename

from app.ai.analyzer import SkinAnalyzer
from app.extensions import db
from app.models import Report

main_bp = Blueprint("main", __name__)
analyzer = SkinAnalyzer()

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@main_bp.route("/")
def home():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))
    return redirect(url_for("auth.login"))


@main_bp.route("/dashboard")
@login_required
def dashboard():
    reports = (
        Report.query.filter_by(user_id=current_user.id)
        .order_by(Report.created_at.desc())
        .limit(8)
        .all()
    )
    trend_labels = [r.created_at.strftime("%b %d") for r in reports][::-1]
    trend_values = [round(r.color_score, 3) for r in reports][::-1]
    return render_template("dashboard.html", reports=reports, trend_labels=trend_labels, trend_values=trend_values)


@main_bp.route("/upload", methods=["GET", "POST"])
@login_required
def upload_analysis():
    if request.method == "POST":
        file = request.files.get("image")
        region = request.form.get("region", "skin").lower()

        if not file or file.filename == "":
            flash("Please choose an image to upload.", "danger")
            return redirect(url_for("main.upload_analysis"))
        if not _allowed_file(file.filename):
            flash("Unsupported file type. Upload png/jpg/jpeg/webp.", "danger")
            return redirect(url_for("main.upload_analysis"))

        filename = secure_filename(file.filename)
        stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        saved_name = f"{current_user.id}_{stamp}_{filename}"
        destination = Path(current_app.config["UPLOAD_FOLDER"]) / saved_name
        file.save(destination)

        historical_scores = [r.color_score for r in current_user.reports.order_by(Report.created_at.desc()).limit(10).all()]
        result = analyzer.analyze(destination, region, historical_scores)

        report = Report(
            user_id=current_user.id,
            image_path=f"uploads/{saved_name}",
            region=region,
            condition=result.condition,
            severity=result.severity,
            confidence=result.confidence,
            observations=result.observations,
            trend_analysis=result.trend_analysis,
            recommendation=result.recommendation,
            color_score=result.color_score,
        )
        db.session.add(report)
        db.session.commit()

        flash("Analysis complete. Report generated.", "success")
        return redirect(url_for("main.report_detail", report_id=report.id))

    return render_template("upload.html")




@main_bp.route("/uploads/<path:filename>")
@login_required
def uploaded_file(filename: str):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)


@main_bp.route("/reports")
@login_required
def reports_history():
    reports = Report.query.filter_by(user_id=current_user.id).order_by(Report.created_at.desc()).all()
    return render_template("reports.html", reports=reports)


@main_bp.route("/reports/<int:report_id>")
@login_required
def report_detail(report_id: int):
    report = Report.query.filter_by(id=report_id, user_id=current_user.id).first_or_404()
    return render_template("report_detail.html", report=report)


@main_bp.route("/reports/<int:report_id>/pdf")
@login_required
def download_report_pdf(report_id: int) -> Response:
    report = Report.query.filter_by(id=report_id, user_id=current_user.id).first_or_404()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, "SkinScope AI Diagnostic Report", ln=1)
    pdf.cell(0, 8, f"Date: {report.created_at.strftime('%Y-%m-%d %H:%M UTC')}", ln=1)
    pdf.cell(0, 8, f"Region: {report.region.title()}", ln=1)
    pdf.cell(0, 8, f"Condition: {report.condition}", ln=1)
    pdf.cell(0, 8, f"Severity: {report.severity}", ln=1)
    pdf.cell(0, 8, f"Confidence: {report.confidence:.2f}", ln=1)
    pdf.multi_cell(0, 8, f"Observations: {report.observations}")
    pdf.multi_cell(0, 8, f"Trend Analysis: {report.trend_analysis}")
    pdf.multi_cell(0, 8, f"Recommendation: {report.recommendation}")

    out_path = Path(current_app.config["UPLOAD_FOLDER"]) / f"report_{report.id}.pdf"
    pdf.output(str(out_path))
    return send_file(out_path, as_attachment=True, download_name=f"skinscope_report_{report.id}.pdf")
