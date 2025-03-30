import { writable } from 'svelte/store';

// Access token store
export const accessToken = writable(localStorage.getItem("access_token") || null);

// Subscribe to changes and update localStorage
accessToken.subscribe(value => {
    if (value) {
        localStorage.setItem('access_token', value);
    }
});

// Initialize user profile with values from localStorage if available
const storedProfile = localStorage.getItem('userProfile');
const initialProfile = storedProfile ? JSON.parse(storedProfile) : { 
    profilePicUrl: '',
    theme: 'dark'
};

export const userProfile = writable(initialProfile);

// Subscribe to changes and update localStorage
userProfile.subscribe(value => {
    localStorage.setItem('userProfile', JSON.stringify(value));
});

// Backend URL
export const backendUrl = import.meta.env ? (import.meta.env.VITE_BACKEND_URL || 'https://spydercare-backend-new-git-main-srushti6226s-projects.vercel.app/') : 'https://spydercare-backend-new-git-main-srushti6226s-projects.vercel.app/';

// Fetch user profile function
export async function fetchUserProfile(token) {
    try {
        const response = await fetch(`${backendUrl}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
            
        if (response.ok) {
            const data = await response.json();
            userProfile.set(data);
            localStorage.setItem("userProfile", JSON.stringify(data));
        } else if (response.status === 401) {
            // Token expired or invalid
            accessToken.set(null);
            userProfile.set(null);
            localStorage.removeItem("access_token");
            localStorage.removeItem("userProfile");
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}
