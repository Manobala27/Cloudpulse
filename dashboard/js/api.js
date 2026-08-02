/* eslint-disable no-unused-vars */
let API_BASE_URL = localStorage.getItem('cloudpulse_endpoint') || 
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
        ? "http://localhost:3000"
        : "https://c2064m9sol.execute-api.ap-south-1.amazonaws.com/dev");

class ApiClient {
    static getAuthHeaders() {
        const token = localStorage.getItem('cloudpulse_jwt');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    static handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('cloudpulse_jwt');
            localStorage.removeItem('cloudpulse_jwt_expiry');
            localStorage.removeItem('cloudpulse_username');
            window.location.href = 'login.html';
            throw new Error('Unauthorized');
        }
        return response;
    }

    static async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            if (response.status === 401) {
                throw new Error('Invalid credentials');
            }
            if (!response.ok) {
                throw new Error('Login failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Login Error:', error);
            throw error;
        }
    }

    static async getHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`, {
                headers: this.getAuthHeaders()
            });
            this.handleAuthError(response);
            if (!response.ok) throw new Error('Health check failed');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async getLogs(limit = 100) {
        try {
            const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            this.handleAuthError(response);
            if (response.status === 404) return { logs: [] };
            if (!response.ok) throw new Error('Failed to fetch logs');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async getLogsByService(service, limit = 100) {
        try {
            const response = await fetch(`${API_BASE_URL}/logs/service/${service}?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            this.handleAuthError(response);
            if (response.status === 404) return { logs: [] };
            if (!response.ok) throw new Error('Failed to fetch service logs');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async getLogsByLevel(level, limit = 100) {
        try {
            const response = await fetch(`${API_BASE_URL}/logs/level/${level}?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            this.handleAuthError(response);
            if (response.status === 404) return { logs: [] };
            if (!response.ok) throw new Error('Failed to fetch level logs');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}
