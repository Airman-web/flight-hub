from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    profile_picture = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    search_history = db.relationship('SearchHistory', backref='user', lazy=True, cascade='all, delete-orphan')
    preferences = db.relationship('UserPreferences', backref='user', uselist=False, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password is correct"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'created_at': self.created_at.isoformat(),
            'profile_picture': self.profile_picture
        }
class SearchHistory(db.Model):
    """Store user search history"""
    __tablename__ = 'search_history'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    search_type = db.Column(db.String(50), nullable=False)  # 'flight', 'airport', 'airline'
    search_query = db.Column(db.String(255), nullable=False)
    results = db.Column(db.JSON, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Return all relevant info including results"""
        # Ensure results is always a dict/list, not None
        results_data = self.results or {}
        # If stored as string in SQLite, parse JSON
        if isinstance(results_data, str):
            try:
                results_data = json.loads(results_data)
            except json.JSONDecodeError:
                results_data = {}
        
        return {
            'id': self.id,
            'search_type': self.search_type,
            'search_query': self.search_query,
            'results': results_data,  #  include results
            'timestamp': self.timestamp.isoformat()
        }

    def to_dict(self):
        return {
            'id': self.id,
            'search_type': self.search_type,
            'search_query': self.search_query,
            'results': self.results or {},
            'timestamp': self.timestamp.isoformat()
        }

class APICache(db.Model):
    """Cache API responses"""
    __tablename__ = 'api_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    cache_key = db.Column(db.String(500), unique=True, nullable=False, index=True)
    api_source = db.Column(db.String(100), nullable=False)  # 'aviationstack', 'openweather', 'opensky'
    data = db.Column(db.JSON, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @staticmethod
    def is_valid(cache_entry):
        """Check if cache entry is still valid"""
        if not cache_entry:
            return False
        return datetime.utcnow() < cache_entry.expires_at

class UserPreferences(db.Model):
    """Store user preferences"""
    __tablename__ = 'user_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    favorite_airlines = db.Column(db.JSON, default=list)  # List of airline codes
    favorite_airports = db.Column(db.JSON, default=list)  # List of airport codes
    theme = db.Column(db.String(20), default='dark')  # 'dark' or 'light'
    notifications_enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'favorite_airlines': self.favorite_airlines or [],
            'favorite_airports': self.favorite_airports or [],
            'theme': self.theme,
            'notifications_enabled': self.notifications_enabled
        }