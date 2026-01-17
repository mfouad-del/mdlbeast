"use client"
import App from '../../App'
export default function UsersPage() {
    // Ideally this would only render the UserManagement component, but for now we wrap App 
    // to keep it functional while refactoring
    return <App />
}
