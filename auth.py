from flask import Blueprint, render_template, redirect, url_for, request, session, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
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
    
    # Check if Google OAuth is configured
    google_oauth_enabled = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    
    return render_template('auth/login.html', google_oauth_enabled=google_oauth_enabled)

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
    
    # Check if Google OAuth is configured
    google_oauth_enabled = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    
    # Signup is handled in login.html with tabs, so we redirect to login with signup tab
    return render_template('auth/login.html', google_oauth_enabled=google_oauth_enabled, show_signup=True)


@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """Allow users to reset their password by verifying email ownership"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        new_password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        if not email or not new_password or not confirm_password:
            flash('❌ All fields are required', 'error')
            return redirect(url_for('auth.forgot_password'))

        if new_password != confirm_password:
            flash('❌ Passwords do not match', 'error')
            return redirect(url_for('auth.forgot_password'))

        if len(new_password) < 6:
            flash('❌ Password must be at least 6 characters', 'error')
            return redirect(url_for('auth.forgot_password'))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash('❌ No account found with that email address', 'error')
            return redirect(url_for('auth.forgot_password'))

        user.set_password(new_password)
        db.session.commit()

        flash('✅ Password updated successfully. Please log in with your new password.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/forgot_password.html')

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
    print("=" * 60)
    print("🔍 Google Login Route Called")
    print(f"GOOGLE_CLIENT_ID exists: {bool(GOOGLE_CLIENT_ID)}")
    print(f"GOOGLE_CLIENT_SECRET exists: {bool(GOOGLE_CLIENT_SECRET)}")
    print("=" * 60)
    
    # Check if Google OAuth is configured
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        print("❌ Missing Google OAuth credentials")
        flash('❌ Google OAuth is not configured. Please use email/password login.', 'error')
        return redirect(url_for('auth.login'))
    
    try:
        google_config = requests.get(GOOGLE_DISCOVERY_URL).json()
        authorization_endpoint = google_config["authorization_endpoint"]
        
        # Determine redirect URI based on environment
        if request.host.startswith('localhost') or request.host.startswith('127.0.0.1'):
            # Local development
            redirect_uri = url_for('auth.google_callback', _external=True, _scheme='http')
        else:
            # Production (atigbi.tech)
            redirect_uri = url_for('auth.google_callback', _external=True, _scheme='https')
        
        print(f"📍 Redirect URI: {redirect_uri}")
        
        request_uri = (
            f"{authorization_endpoint}"
            f"?client_id={GOOGLE_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope=openid email profile"
            f"&prompt=select_account"
            f"&access_type=offline"
        )
        
        print(f"🔗 Redirecting to Google...")
        return redirect(request_uri)
        
    except Exception as e:
        print(f"❌ Google OAuth Error: {str(e)}")
        import traceback
        traceback.print_exc()
        flash('❌ Google login is currently unavailable. Please use email/password login.', 'error')
        return redirect(url_for('auth.login'))


@auth_bp.route('/google/callback')
def google_callback():
    """Handle Google OAuth callback"""
    # Check if Google OAuth is configured first
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        flash('❌ Google OAuth is not configured. Please use email/password login.', 'error')
        return redirect(url_for('auth.login'))
    
    # Check for error from Google
    error = request.args.get('error')
    if error:
        error_description = request.args.get('error_description', 'Unknown error')
        print(f"Google OAuth Error: {error} - {error_description}")
        
        if error == 'access_denied':
            flash('❌ Google login was cancelled. Please try again or use email/password login.', 'error')
        elif error == 'invalid_client':
            flash('❌ Google OAuth is not properly configured. Please use email/password login.', 'error')
        else:
            flash(f'❌ Google login failed: {error_description}. Please use email/password login.', 'error')
        
        return redirect(url_for('auth.login'))
    
    code = request.args.get('code')
    
    if not code:
        flash('❌ Authorization failed. No authorization code received.', 'error')
        return redirect(url_for('auth.login'))
    
    try:
        # Get token from Google
        google_config = requests.get(GOOGLE_DISCOVERY_URL).json()
        token_endpoint = google_config["token_endpoint"]
        
        # Determine redirect URI based on environment (same logic as in google_login)
        if request.host.startswith('localhost') or request.host.startswith('127.0.0.1'):
            redirect_uri = url_for('auth.google_callback', _external=True, _scheme='http')
        else:
            redirect_uri = url_for('auth.google_callback', _external=True, _scheme='https')
        
        print(f"📍 Using redirect URI for token: {redirect_uri}")
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        response = requests.post(token_endpoint, data=token_data)
        
        # Check if token request was successful
        if response.status_code != 200:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get('error_description', error_data.get('error', 'Token request failed'))
            print(f"Google OAuth Token Error: {error_msg}")
            print(f"Response: {response.text}")
            flash('❌ Google login failed. Please use email/password login.', 'error')
            return redirect(url_for('auth.login'))
        
        tokens = response.json()
        
        # Check if we got an error in the response
        if 'error' in tokens:
            error_msg = tokens.get('error_description', tokens.get('error', 'Unknown error'))
            print(f"Google OAuth Token Error: {error_msg}")
            flash('❌ Google login failed. Please use email/password login.', 'error')
            return redirect(url_for('auth.login'))
        
        if 'access_token' not in tokens:
            print("Google OAuth Error: No access token in response")
            flash('❌ Google login failed. Please use email/password login.', 'error')
            return redirect(url_for('auth.login'))
        
        # Get user info from Google
        userinfo_endpoint = google_config["userinfo_endpoint"]
        userinfo_response = requests.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        if userinfo_response.status_code != 200:
            print(f"Google OAuth UserInfo Error: Status {userinfo_response.status_code}")
            flash('❌ Failed to get user information from Google. Please use email/password login.', 'error')
            return redirect(url_for('auth.login'))
        
        userinfo = userinfo_response.json()
        print(f"✓ Got user info for: {userinfo.get('email')}")
        
        # Check if user exists
        user = User.query.filter_by(google_id=userinfo['sub']).first()
        
        if not user:
            # Check if email already exists
            user = User.query.filter_by(email=userinfo['email']).first()
            if user:
                # Link Google account to existing user
                print(f"✓ Linking Google account to existing user: {user.email}")
                user.google_id = userinfo['sub']
                user.profile_picture = userinfo.get('picture')
                db.session.commit()
            else:
                # Create new user from Google data
                print(f"✓ Creating new user from Google: {userinfo['email']}")
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
        print(f"✓ User logged in: {user.email}")
        flash(f'✅ Welcome, {user.username}!', 'success')
        return redirect(url_for('dashboard'))
    
    except Exception as e:
        print(f"❌ Google OAuth Error: {str(e)}")
        import traceback
        traceback.print_exc()
        flash('❌ Google login failed. Please use email/password login.', 'error')
        return redirect(url_for('auth.login'))
    
@auth_bp.route('/profile')
@login_required
def profile():
    """User profile page"""
    return render_template('auth/profile.html', user=current_user)
