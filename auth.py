from flask import Blueprint, render_template, redirect, url_for, request, session, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import requests
import os
from database import db, User, UserPreferences

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            flash('✅ Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('❌ Invalid email or password', 'error')
    
    return render_template('auth/login.html')

@auth_bp.route('/signup', methods=['GET', 'POST'])
def signup():
    """Sign up page"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validation
        if not email or not username or not password:
            flash('❌ All fields are required', 'error')
            return redirect(url_for('auth.signup'))
        
        if password != confirm_password:
            flash('❌ Passwords do not match', 'error')
            return redirect(url_for('auth.signup'))
        
        if len(password) < 6:
            flash('❌ Password must be at least 6 characters', 'error')
            return redirect(url_for('auth.signup'))
        
        # Check if user exists
        if User.query.filter_by(email=email).first():
            flash('❌ Email already registered', 'error')
            return redirect(url_for('auth.signup'))
        
        if User.query.filter_by(username=username).first():
            flash('❌ Username already taken', 'error')
            return redirect(url_for('auth.signup'))
        
        # Create new user
        user = User(email=email, username=username)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Create user preferences
        preferences = UserPreferences(user_id=user.id)
        db.session.add(preferences)
        db.session.commit()
        
        flash('✅ Account created successfully! Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('auth/signup.html')

@auth_bp.route('/logout')
@login_required
def logout():
    """Logout user"""
    logout_user()
    flash('✅ Logged out successfully!', 'success')
    return redirect(url_for('auth.login'))

@auth_bp.route('/google/login')
def google_login():
    """Start Google OAuth flow"""
    google_config = requests.get(GOOGLE_DISCOVERY_URL).json()
    authorization_endpoint = google_config["authorization_endpoint"]

    request_uri = (
        f"{authorization_endpoint}"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={url_for('auth.google_callback', _external=True)}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&prompt=select_account"           # <-- Forces account chooser
        f"&access_type=offline"             # <-- Needed for refresh token
    )

    return redirect(request_uri)


@auth_bp.route('/google/callback')
def google_callback():
    """Handle Google OAuth callback"""
    code = request.args.get('code')
    
    if not code:
        flash('❌ Authorization failed', 'error')
        return redirect(url_for('auth.login'))
    
    try:
        # Get token from Google
        google_config = requests.get(GOOGLE_DISCOVERY_URL).json()
        token_endpoint = google_config["token_endpoint"]
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': url_for('auth.google_callback', _external=True),
            'grant_type': 'authorization_code'
        }
        
        response = requests.post(token_endpoint, data=token_data)
        tokens = response.json()
        
        # Get user info from Google
        userinfo_endpoint = google_config["userinfo_endpoint"]
        userinfo_response = requests.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        userinfo = userinfo_response.json()
        
        # Check if user exists
        user = User.query.filter_by(google_id=userinfo['sub']).first()
        
        if not user:
            # Create new user from Google data
            user = User(
                email=userinfo['email'],
                username=userinfo.get('name', userinfo['email'].split('@')[0]),
                google_id=userinfo['sub'],
                profile_picture=userinfo.get('picture')
            )
            db.session.add(user)
            db.session.commit()
            
            # Create user preferences
            preferences = UserPreferences(user_id=user.id)
            db.session.add(preferences)
            db.session.commit()
        
        # Login user
        login_user(user)
        flash(f'✅ Welcome, {user.username}!', 'success')
        return redirect(url_for('dashboard'))
    
    except Exception as e:
        print(f"Google OAuth Error: {str(e)}")
        flash('❌ Google login failed', 'error')
        return redirect(url_for('auth.login'))

@auth_bp.route('/profile')
@login_required
def profile():
    """User profile page"""
    return render_template('auth/profile.html', user=current_user)

@auth_bp.route('/api/user')
@login_required
def get_user_data():
    """Get current user data as JSON"""
    return jsonify(current_user.to_dict())