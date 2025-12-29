/**
 * Secure fetch wrapper that adds authentication headers
 */
export async function secureFetch(url: string, options: RequestInit = {}) {
    const session = localStorage.getItem("postergram_auth");
    let pin = "";

    if (session) {
        try {
            // "login" in AuthProvider just passed the pin to login() but stored { authenticated: true, expiry... }
            // Wait, AuthProvider didn't store the PIN in localStorage!
            // I need to fix AuthProvider to store the PIN if I want to retrieve it here.
            // OR I can prompt the user again? No that's bad UX.
            // I will assume the AuthProvider has been updated OR I will update it now.
            // Let's check if I can just grab it from a temporary storage or if I need to update AuthProvider first.

            // Checking AuthProvider again... it does NOT store the PIN.
            // So I MUST update AuthProvider to store the PIN in localStorage.
            const data = JSON.parse(session);
            if (data.pin) {
                pin = data.pin;
            }
        } catch (e) {
            console.error("Failed to parse session", e);
        }
    }

    const headers = {
        ...options.headers,
        "Content-Type": "application/json",
        "x-app-pin": pin,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        // Redirect to login if unauthorized
        window.location.reload();
    }

    return res;
}
