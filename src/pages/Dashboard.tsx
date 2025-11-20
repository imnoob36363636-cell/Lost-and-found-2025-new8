import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ChatRequests from '../components/Dashboard/ChatRequests';

interface UserItem {
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
}

const Dashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Normalize ids
  const normalizeUserItems = (rawItems: any[] = []): UserItem[] =>
    rawItems.map((i, idx) => {
      const id = String(i.id ?? i._id ?? `generated-${idx}`);
      return { ...i, id } as UserItem;
    });

  const fetchUserItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/items/my-items');
      const normalized = normalizeUserItems(response.data.items || []);
      setItems(normalized);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to fetch items', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await api.delete(`/items/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast('Item deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete item', 'error');
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    // debug: ensure handler runs
    console.log('handleStatusUpdate called for', id, '->', newStatus);

    try {
      const res = await api.patch(`/items/${id}/status`, { status: newStatus });

      // updated item from backend OR fallback
      const apiItem = res.data?.item;
      const realId = String(apiItem?.id ?? apiItem?._id ?? id);

      const updatedItem = {
        ...(apiItem ?? {}),
        id: realId,
        _id: realId,
        status: apiItem?.status ?? newStatus,
      };

      console.log('Dispatching itemUpdated with:', updatedItem);

      // update dashboard UI immediately
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updatedItem.status } : item))
      );

      // notify BrowseItems and request a refetch to be authoritative
      window.dispatchEvent(
        new CustomEvent('itemUpdated', { detail: { ...updatedItem, refetch: true } })
      );

      showToast('Status updated successfully', 'success');
    } catch (error: any) {
      console.error('handleStatusUpdate error:', error?.response?.data ?? error);
      showToast(error.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
        </div>

        <Link
          to="/upload"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Upload New Item</span>
        </Link>
      </div>

      <div className="mb-8">
        <ChatRequests />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <p className="text-gray-600 text-lg mb-4">You haven't uploaded any items yet</p>
          <Link
            to="/upload"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Your First Item
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <img
                          src={item.imageUrl || 'https://via.placeholder.com/100'}
                          alt={item.title}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                        <div className="ml-4">
                          <Link to={`/item/${item.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                            {item.title}
                          </Link>
                          <div className="text-sm text-gray-500">{item.location}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</td>

                    <td className="px-6 py-4">
                      <div className="flex space-x-3">
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;