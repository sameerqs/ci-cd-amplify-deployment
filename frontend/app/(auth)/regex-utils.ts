export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const phoneRegex = /^(\+?1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/


export const lettersAndSpacesRegex = /^[a-zA-Z0-9\s]*$/

export const alphanumericSpacesRegex = /^[a-zA-Z0-9\s]*$/

export const addressRegex = /^[a-zA-Z0-9\s.,#\-/]*$/
