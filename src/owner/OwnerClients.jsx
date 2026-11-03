import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClientManagement from './ClientManagement';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OwnerClients() {
  const navigate = useNavigate();
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const location = useLocation();
const enquiry = location.state?.enquiry || null;

  useEffect(() => {
    async function checkOwner() {
      try {
        const response = await fetch(`${API_URL}/api/owner/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          navigate('/owner/login', { replace: true });
          return;
        }

        const data = await response.json();
        setCsrfToken(data.csrfToken);
      } catch (error) {
        console.error('Owner authentication failed:', error);
        navigate('/owner/login', { replace: true });
      } finally {
        setLoading(false);
      }
    }

    checkOwner();
  }, [navigate]);

  if (loading) {
    return <p>Loading client management...</p>;
  }

  if (!csrfToken) {
    return null;
  }

  return (
  <ClientManagement
    csrfToken={csrfToken}
    enquiry={enquiry}
  />
);;
}