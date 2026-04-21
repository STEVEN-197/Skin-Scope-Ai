from datetime import datetime

from app.extensions import db


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    region = db.Column(db.String(20), nullable=False)
    condition = db.Column(db.String(80), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    observations = db.Column(db.Text, nullable=False)
    trend_analysis = db.Column(db.String(80), nullable=False)
    recommendation = db.Column(db.Text, nullable=False)
    color_score = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = db.relationship("User", back_populates="reports")
