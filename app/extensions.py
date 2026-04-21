from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

# Shared extension instances initialized in the app factory.
db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "warning"
