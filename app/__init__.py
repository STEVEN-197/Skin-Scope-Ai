from pathlib import Path

from flask import Flask

from app.auth.routes import auth_bp
from app.extensions import db, login_manager
from app.routes.main import main_bp


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.update(
        SECRET_KEY="change-me-in-production",
        SQLALCHEMY_DATABASE_URI="sqlite:///skinscope.db",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=str(Path(app.instance_path) / "uploads"),
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    )

    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)

    with app.app_context():
        from app import models  # noqa: F401

        db.create_all()

    return app
