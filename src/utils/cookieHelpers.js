/**
 * Utility functions for managing browser cookies with JSON support
 */

/**
 * Sets a cookie with a given name, value, and expiration days
 * @param {string} name 
 * @param {any} value - Will be JSON stringified
 * @param {number} days 
 */
export const setCookie = (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));

    const jsonValue = JSON.stringify(value);
    // Base64 encode to avoid issues with special characters in JSON
    const encodedValue = btoa(unescape(encodeURIComponent(jsonValue)));

    document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

/**
 * Gets a cookie by name and parses it as JSON
 * @param {string} name 
 * @returns {any|null}
 */
export const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            try {
                const encodedValue = c.substring(nameEQ.length, c.length);
                const jsonValue = decodeURIComponent(escape(atob(encodedValue)));
                return JSON.parse(jsonValue);
            } catch (e) {
                console.error('Error parsing cookie:', name, e);
                return null;
            }
        }
    }
    return null;
};

/**
 * Deletes a cookie by name
 * @param {string} name 
 */
export const deleteCookie = (name) => {
    document.cookie = `${name}=; Max-Age=-99999999;path=/;`;
};

/**
 * Generates a unique key based on the current URL path for isolation
 * @param {string} baseKey 
 * @returns {string}
 */
export const getUniqueCookieKey = (baseKey) => {
    const path = window.location.pathname || '/';
    const encodedPath = btoa(path).replace(/=/g, ''); // Simple base64 of path
    return `${baseKey}_${encodedPath}`;
};
