import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

interface ChatRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requesterId: string;
  itemTitle: string;
  itemType: string;
  submittedAnswer: string;
  status: string;
  createdAt: string;
}

const ChatRequests = () => {
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchChatRequests();
  }, []);

  const fetchChatRequests = async () => {
    try {
      const response = await api.get('/chat-requests/incoming');
      setRequests(response.data.chatRequests);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to fetch chat requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (chatRequestId: string) => {
    try {
      await api.patch(`/chat-requests/${chatRequestId}/approve`);
      setRequests(requests.filter((req) => req.id !== chatRequestId));
      showToast('Chat request approved!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to approve request', 'error');
    }
  };

  const handleDecline = async (chatRequestId: string) => {
    try {
      await api.patch(`/chat-requests/${chatRequestId}/decline`);
      setRequests(requests.filter((req) => req.id !== chatRequestId));
      showToast('Chat request declined', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to decline request', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <p className="text-gray-600">No pending chat requests</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Chat Requests</h2>
        <p className="text-sm text-gray-600">Users who answered your verification question correctly</p>
      </div>

      <div className="divide-y divide-gray-200">
        {requests.map((request) => (
          <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{request.requesterName}</h3>
                <p className="text-sm text-gray-600">{request.requesterEmail}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  request.itemType === 'lost'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {request.itemType}
              </span>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Interested in:</p>
              <p className="text-sm font-medium text-gray-900">{request.itemTitle}</p>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Their answer:</p>
              <p className="text-sm font-medium text-gray-900 italic">{request.submittedAnswer}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(request.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium transition-colors"
              >
                <Check className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => handleDecline(request.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium transition-colors"
              >
                <X className="h-4 w-4" />
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatRequests;
