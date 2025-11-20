import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, User, MessageSquare, ArrowLeft } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import VerificationModal from '../components/Messaging/VerificationModal';

interface RawUserObj {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
}

interface ItemDetails {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  imageUrl: string;
  status: string;
  type: string;
  createdAt: string;
  verificationQuestion?: string;
  user: {
    id: string;
    _id?: string;
    name: string;
    email: string;
  };
}

const ItemDetails = () => {
  const params = useParams<{ id?: string }>();
  const routeId = params.id;
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [item, setItem] = useState<ItemDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);

  /**
   * normalizeFetchedItem handles cases where raw.user can be:
   * - a populated object { _id, name, email }
   * - a string ObjectId like '64a1...'
   * - an object with only _id
   */
  const normalizeFetchedItem = (raw: any): ItemDetails | null => {
    if (!raw) return null;

    // Determine user data from raw.user which can be string or object
    let normalizedUser: { id: string; _id?: string; name: string; email: string } = {
      id: '',
      _id: undefined,
      name: 'Unknown',
      email: '',
    };

    const rawUser = raw.user;

    if (!rawUser) {
      // no user info at all
      normalizedUser = { id: '', name: 'Unknown', email: '' };
    } else if (typeof rawUser === 'string') {
      // user is just an id string
      normalizedUser = { id: String(rawUser), _id: String(rawUser), name: 'Unknown', email: '' };
    } else if (typeof rawUser === 'object') {
      // user is an object — could have id or _id, name, email
      normalizedUser = {
        id: String((rawUser as RawUserObj).id ?? (rawUser as RawUserObj)._id ?? ''),
        _id: (rawUser as RawUserObj)._id ?? (rawUser as RawUserObj).id,
        name: (rawUser as RawUserObj).name ?? 'Unknown',
        email: (rawUser as RawUserObj).email ?? '',
      };
    } else {
      // fallback
      normalizedUser = { id: String(rawUser), name: 'Unknown', email: '' };
    }

    const normalizedItem: ItemDetails = {
      ...raw,
      id: String(raw.id ?? raw._id ?? ''),
      _id: raw._id ?? raw.id,
      title: raw.title ?? '',
      description: raw.description ?? '',
      category: raw.category ?? '',
      location: raw.location ?? '',
      imageUrl: raw.imageUrl ?? '',
      status: raw.status ?? '',
      type: raw.type ?? '',
      createdAt: raw.createdAt ?? new Date().toISOString(),
      user: normalizedUser,
    };

    // If either id or user.id is empty, return null to indicate invalid payload
    if (!normalizedItem.id || !normalizedItem.user?.id) return null;
    return normalizedItem;
  };

  useEffect(() => {
    if (!routeId || routeId === 'undefined') {
      showToast('Invalid item id', 'error');
      setLoading(false);
      return;
    }
    fetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const fetchItem = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/items/${routeId}`);
      console.log('fetchItem raw response:', response.data);

      // be flexible: some APIs use response.data.item, some return the object directly
      const fetched = response.data?.item ?? response.data;
      const normalized = normalizeFetchedItem(fetched);

      if (!normalized) {
        console.warn('Normalized item is null (malformed or missing user)', fetched);
        showToast('Item data is malformed or incomplete', 'error');
        setItem(null);
      } else {
        setItem(normalized);
      }
    } catch (error: any) {
      console.error('fetchItem error:', error);
      showToast(error?.response?.data?.message || 'Failed to fetch item', 'error');
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get current user id reliably (string)
  const getCurrentUserId = () => {
    if (!user) return '';
    // support both user.id and user._id
    // @ts-ignore - user shape may vary depending on your AuthContext
    return String(user.id ?? user._id ?? '');
  };

  const currentUserId = getCurrentUserId();
  const itemOwnerId = item?.user?.id ?? item?.user?._id ?? '';
  const isOwner = currentUserId !== '' && itemOwnerId !== '' && currentUserId === itemOwnerId;

  // debug logs - remove in production
  useEffect(() => {
    console.debug('Auth user (raw):', user);
    console.debug('Normalized currentUserId:', currentUserId);
    console.debug('Normalized item:', item);
    console.debug('Normalized itemOwnerId:', itemOwnerId);
    console.debug('isOwner:', isOwner);
  }, [user, item, currentUserId, itemOwnerId, isOwner]);

  const handleContact = async () => {
    if (!user) {
      showToast('Please login to contact', 'error');
      navigate('/login');
      return;
    }

    if (!item) {
      showToast('No item to contact about', 'error');
      return;
    }

    if (item.verificationQuestion) {
      setShowVerification(true);
      return;
    }

    proceedWithContact();
  };

  const proceedWithContact = async () => {
    if (!item) return;

    const senderId = currentUserId;
    const recipientId = itemOwnerId;
    const itemId = String(item.id ?? item._id ?? '');

    if (!senderId) {
      showToast('Your user id is not available. Please login again.', 'error');
      return;
    }
    if (!recipientId) {
      showToast('Recipient id is not available for this item', 'error');
      return;
    }

    const payload = {
      participants: [senderId, recipientId],
      senderId,
      recipientId,
      itemId,
      message: `Hi! I'm interested in your ${item.type} item: ${item.title}`,
    };

    try {
      console.log('Sending message payload:', payload);
      const res = await api.post('/messages', payload);
      console.log('Message create response:', res.data);
      showToast('Message sent successfully!', 'success');
      navigate('/messages');
    } catch (error: any) {
      console.error('handleContact error response:', error?.response?.data ?? error);
      const serverMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        JSON.stringify(error?.response?.data) ||
        'Failed to send message';
      showToast(serverMsg, 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">Item not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back</span>
      </button>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="relative h-96 bg-gray-200">
            <img
              src={item.imageUrl || 'https://via.placeholder.com/600x400?text=No+Image'}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  item.type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}
              >
                {item.type === 'lost' ? 'Lost Item' : 'Found Item'}
              </span>
            </div>
          </div>

          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{item.title}</h1>

            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-5 w-5" />
                <span>{item.location}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="h-5 w-5" />
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <User className="h-5 w-5" />
                <span>Posted by {item.user.name || 'Unknown'}</span>
              </div>
            </div>

            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {item.category}
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-gray-700 leading-relaxed">{item.description}</p>
            </div>

            {/* Render the button only when there's a logged-in user and they are NOT the owner */}
            {user && !isOwner && (
              <button
                onClick={handleContact}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <MessageSquare className="h-5 w-5" />
                <span>Contact Owner</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showVerification && item && item.verificationQuestion && (
        <VerificationModal
          itemId={String(item.id ?? item._id ?? '')}
          question={item.verificationQuestion}
          onClose={() => setShowVerification(false)}
          onSuccess={() => {
            setShowVerification(false);
            showToast('Answer verified! Chat request sent to owner.', 'success');
          }}
        />
      )}
    </div>
  );
};

export default ItemDetails;
