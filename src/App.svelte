<script>
  import { Router, Route, navigate } from "svelte-routing";
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';

  import LandingPage from "./LandingPage.svelte";
  import LoginPage from "./LoginPage.svelte";
  import ChatPage from "./ChatPage.svelte";
  import ProfilePage from "./ProfilePage.svelte";
  import SettingsPage from "./SettingsPage.svelte";

  // Use a writable store for access token and user profile
  export const accessToken = writable(localStorage.getItem("access_token") || null);
  export const userProfile = writable(JSON.parse(localStorage.getItem("user_profile")) || null);

  // Define backend URL (update with your deployed backend URL)
  export const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://spydercare-backend-new-git-main-srushti6226s-projects.vercel.app/';

  onMount(() => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) {
      accessToken.set(storedToken);
      fetchUserProfile(storedToken);
    }
  });

  // Fetch user profile if logged in
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
        localStorage.setItem("user_profile", JSON.stringify(data));
      } else if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }

  // Handles the login event from LoginPage
  function handleLogin({detail}) {
    // LoginPage component now handles the actual login API call
    // We just need to ensure navigation here if needed
    if (detail && detail.success) {
      navigate('/chat');
    }
  }

  function handleLogout() {
    accessToken.set(null);
    userProfile.set(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_profile");
    navigate('/');
  }

  function requireAuth(component) {
    let token;
    const unsubscribe = accessToken.subscribe(value => {
      token = value;
    });
    unsubscribe(); // Properly unsubscribe after getting the value
    
    return token ? component : LoginPage;
  }
</script>

<Router>
  <Route path="/" component={LandingPage} />
  <Route path="/login" component={LoginPage} />
  <Route path="/chat" component={requireAuth(ChatPage)} />
  <Route path="/profile" component={requireAuth(ProfilePage)} />
  <Route path="/settings" component={requireAuth(SettingsPage)} />
  <Route path="/*" component={LandingPage} />
</Router>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0b1e;
    overflow-x: hidden;
  }

  :global(html) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    box-sizing: border-box;
  }
  
  :global(*, *:before, *:after) {
    box-sizing: inherit;
  }
  
  :global(a) {
    text-decoration: none;
    color: inherit;
  }
  
  :global(button) {
    cursor: pointer;
  }
</style>