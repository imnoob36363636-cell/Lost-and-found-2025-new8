# Item-Based Verification Question System

## Overview

The Lost & Found application now includes a comprehensive verification question system that prevents unauthorized chat requests. Item owners can set custom verification questions and answers, and users must answer correctly before they can request contact or send messages.

## System Architecture

### 1. Database Models

#### ChatRequest Model
Stores all chat request interactions with verification status:
```
- item: Reference to Item
- requester: User attempting to contact
- owner: Item owner
- verificationQuestion: The question text
- correctAnswer: Expected answer (case-insensitive)
- submittedAnswer: User's submitted answer
- answerCorrect: Boolean status
- status: pending | approved | declined
- conversation: Link to approved conversation
```

#### Item Model Updates
Added verification fields:
```
- verificationQuestion: Optional question text
- verificationAnswer: Expected answer (stored lowercase)
```

### 2. Backend Endpoints

#### POST `/api/chat-requests/answer`
Submits a verification answer
- **Auth**: Required (logged-in user)
- **Body**: `{ itemId, answer }`
- **Response**:
  - `200 OK`: `{ success: true/false, message, chatRequest: id }`
  - Automatically creates ChatRequest record

#### GET `/api/chat-requests/incoming`
Retrieves all incoming chat requests for item owner
- **Auth**: Required (logged-in user)
- **Response**: Array of chat requests with requester details

#### PATCH `/api/chat-requests/:chatRequestId/approve`
Owner approves chat request
- **Auth**: Required (must be item owner)
- **Response**: `{ message: "Chat request approved", conversation: id }`
- **Side effects**: Creates Conversation, sends notification

#### PATCH `/api/chat-requests/:chatRequestId/decline`
Owner declines chat request
- **Auth**: Required (must be item owner)
- **Response**: `{ message: "Chat request declined" }`

#### GET `/api/chat-requests/status/:itemId`
Checks current verification status for a user+item
- **Auth**: Required
- **Response**: `{ hasRequest, answered, answerCorrect, status }`

### 3. Message Sending Verification

The `sendMessage` endpoint now enforces verification:
```
- If item has verification question
  - Check if ChatRequest exists with status: "approved"
  - If not approved, reject with 403 error
- If item has no question, allow messaging
```

## Frontend Features

### 1. Upload Item Page (`UploadItem.tsx`)

New verification section when posting items:
- **Verification Question input**: Optional question to ask potential contacts
- **Correct Answer input**: Expected answer (case-insensitive)
- **Help text**: Explains the purpose and auto-processing

**Example Question**: "What color is the cover of the notebook?"
**Example Answer**: "blue"

### 2. Item Details Page (`ItemDetails.tsx`)

When non-owners click "Contact Owner":
1. If no verification question → Direct contact flow
2. If verification question exists → Show VerificationModal

**VerificationModal** (`VerificationModal.tsx`):
- Displays the question in a modal
- User enters their answer
- Shows error feedback if incorrect
- Submits answer to backend
- On success: Creates chat request and shows confirmation

### 3. Dashboard Page (`Dashboard.tsx`)

New "Chat Requests" section displays:
- **Requester information**: Name and email
- **Item details**: Title and type (lost/found)
- **Their answer**: Shows what they submitted
- **Action buttons**: Approve or Decline

Owners can:
- **Approve**: Creates conversation and unlocks messaging
- **Decline**: Blocks further contact from this user

## Workflow

### For Item Owners (Posting Items)

1. Navigate to "Upload New Item"
2. Fill in item details (title, description, category, etc.)
3. **Optional**: Add verification question and answer
4. Submit

**Example**:
- Question: "What is the first digit of the phone number on the ID?"
- Answer: "5"

### For Interested Users (Browsing)

1. Browse items and find one of interest
2. Click "Contact Owner"
3. If item has verification:
   - See modal with question
   - Submit answer
   - If correct: Chat request sent (owner gets notification)
   - If incorrect: See error, can retry
4. If item has no verification:
   - Direct message flow (backward compatible)

### For Item Owners (Managing Requests)

1. View Dashboard
2. See "Chat Requests" section
3. For each request:
   - View requester's name/email
   - See their submitted answer
   - Click "Approve" to unlock chat
   - Click "Decline" to reject

Once approved:
- Both users can see conversation
- Messages flow normally
- Chat remains available until deleted

## Security & Validation

### Answer Validation
- Case-insensitive matching
- Automatic trimming of whitespace
- Single ChatRequest per user+item pair
- Requires correct answer to proceed

### Permission Checks
- Only item owner can approve/decline requests
- Only approved participants can send messages
- Verification enforcement on every message
- Cannot contact yourself

### Data Protection
- Correct answer only stored at item level
- User answers stored separately
- ChatRequest tracks verification history
- No exposure of correct answer to requesters

## Error Handling

### User Scenarios

**Incorrect Answer**:
```
Error: "Incorrect answer. Please try again."
→ User can retry immediately
```

**Message Without Approval**:
```
Error: "Chat verification not approved. Answer the verification question first."
→ User redirected to verification flow
```

**Not Authorized**:
```
Error: "Not authorized"
→ Only owner can approve/decline
```

## Integration Points

### Existing Features (Backward Compatible)

1. **Items without questions**: Works as before, no verification needed
2. **Conversations**: Unchanged structure, just with verification layer
3. **Messages**: Still use same endpoints, just with additional validation
4. **Notifications**: New notification types for chat requests

### New Notification Types

- `chat_request`: User answered question correctly
- `chat_approved`: Owner approved request
- `chat_declined`: Owner declined request

## Database Schema Changes

### New Collection: ChatRequests
```javascript
{
  item: ObjectId,
  requester: ObjectId,
  owner: ObjectId,
  verificationQuestion: String,
  correctAnswer: String (lowercase),
  submittedAnswer: String (lowercase, nullable),
  answerCorrect: Boolean,
  status: String (enum),
  conversation: ObjectId (nullable),
  createdAt: Date,
  updatedAt: Date
}
```

### Item Collection Changes
```
Added:
- verificationQuestion: String (default: '')
- verificationAnswer: String (default: '', lowercase)
```

## API Flow Diagram

```
User browses item
        ↓
Clicks "Contact Owner"
        ↓
Has verification question?
    ├─ YES → Show VerificationModal
    │         User submits answer
    │         ├─ Correct → POST /chat-requests/answer
    │         │            Creates ChatRequest
    │         │            Owner receives notification
    │         └─ Wrong → Show error
    │
    └─ NO → Create conversation directly
            Message flow starts
```

## Testing Checklist

- [ ] Upload item with verification question
- [ ] Upload item without verification question
- [ ] Answer question correctly → Chat request created
- [ ] Answer question incorrectly → Error shown, can retry
- [ ] Owner sees pending request in Dashboard
- [ ] Owner clicks Approve → Conversation created
- [ ] Owner clicks Decline → Request rejected
- [ ] After approval: Both users can exchange messages
- [ ] Without approval: Messages blocked with error
- [ ] Unverified users cannot send messages directly
- [ ] Question is case-insensitive
- [ ] Whitespace handling works correctly

## Files Modified/Created

### Backend
- ✅ `models/ChatRequest.js` - New
- ✅ `models/Item.js` - Updated
- ✅ `controllers/chatRequestController.js` - New
- ✅ `routes/chatRequestRoutes.js` - New
- ✅ `controllers/messageController.js` - Updated
- ✅ `controllers/itemController.js` - Updated
- ✅ `server.js` - Updated

### Frontend
- ✅ `pages/UploadItem.tsx` - Updated
- ✅ `pages/ItemDetails.tsx` - Updated
- ✅ `pages/Dashboard.tsx` - Updated
- ✅ `components/Messaging/VerificationModal.tsx` - New
- ✅ `components/Dashboard/ChatRequests.tsx` - New

## Future Enhancements

1. **Question Templates**: Pre-built questions for common items
2. **Image Verification**: Upload photos as proof
3. **Multi-step Verification**: Chain multiple questions
4. **Verification History**: Track all answers from users
5. **Admin Review**: Admin panel for dispute resolution
6. **Batch Operations**: Owner can approve/decline multiple requests
7. **Custom Notifications**: Users get reminded of pending requests
8. **Analytics**: Track which questions work best

## Troubleshooting

**Q: Chat request not appearing in Dashboard**
A: Ensure user answered correctly. Only correct answers show as pending requests.

**Q: Message send fails with verification error**
A: Owner hasn't approved the chat request yet. Wait for approval notification.

**Q: Can't set verification on item**
A: Both question and answer must be non-empty for verification to work.

**Q: Same user submitting multiple answers**
A: System tracks most recent answer for each user+item pair.
