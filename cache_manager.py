import json
import os
from datetime import datetime, timedelta
from pathlib import Path

class CacheManager:
    """Manages API response caching to minimize API calls"""
    
    def __init__(self, cache_file='cache/api_cache.json', expiry_hours=24):
        self.cache_file = cache_file
        self.expiry_hours = expiry_hours
        self._ensure_cache_directory()
        self.cache = self._load_cache()
    
    def _ensure_cache_directory(self):
        """Create cache directory if it doesn't exist"""
        cache_dir = os.path.dirname(self.cache_file)
        if cache_dir and not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
    
    def _load_cache(self):
        """Load cache from file"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def _save_cache(self):
        """Save cache to file"""
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def get(self, key):
        """Get cached data if not expired"""
        if key in self.cache:
            cached_data = self.cache[key]
            cached_time = datetime.fromisoformat(cached_data['timestamp'])
            
            # Check if cache is still valid
            if datetime.now() - cached_time < timedelta(hours=self.expiry_hours):
                return cached_data['data']
            else:
                # Cache expired, remove it
                del self.cache[key]
                self._save_cache()
        return None
    
    def set(self, key, data):
        """Store data in cache"""
        self.cache[key] = {
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        self._save_cache()
    
    def clear(self):
        """Clear all cache"""
        self.cache = {}
        self._save_cache()
    
    def get_cache_info(self):
        """Get information about cached items"""
        info = []
        for key, value in self.cache.items():
            cached_time = datetime.fromisoformat(value['timestamp'])
            age = datetime.now() - cached_time
            info.append({
                'key': key,
                'cached_at': value['timestamp'],
                'age_hours': age.total_seconds() / 3600,
                'expired': age > timedelta(hours=self.expiry_hours)
            })
        return info