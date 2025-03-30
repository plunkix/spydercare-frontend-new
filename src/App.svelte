<script>
    import { Router, Route, navigate } from "svelte-routing";
    import { onMount } from 'svelte';
    
    import LandingPage from "./LandingPage.svelte";
    import LoginPage from "./LoginPage.svelte";
    import ChatPage from "./ChatPage.svelte";
    import ProfilePage from "./ProfilePage.svelte";
    import SettingsPage from "./SettingsPage.svelte";
    
    import { accessToken, userProfile, fetchUserProfile } from './stores.js';
    
    onMount(() => {
        const storedToken = localStorage.getItem("access_token");
        if (storedToken) {
            accessToken.set(storedToken);
            fetchUserProfile(storedToken);
        }
    });
    
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
        localStorage.removeItem("userProfile");
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
