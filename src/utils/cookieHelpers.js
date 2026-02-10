/**
 * Utility functions for managing browser cookies with JSON support
 */

export const setCookie = (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));

    const jsonValue = JSON.stringify(value);
    const encodedValue = btoa(unescape(encodeURIComponent(jsonValue)));

    document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};


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


export const deleteCookie = (name) => {
    document.cookie = `${name}=; Max-Age=-99999999;path=/;`;
};


export const getUniqueCookieKey = (baseKey) => {
    const path = window.location.pathname || '/';
    const encodedPath = btoa(path).replace(/=/g, ''); // Simple base64 of path
    return `${baseKey}_${encodedPath}`;
};
