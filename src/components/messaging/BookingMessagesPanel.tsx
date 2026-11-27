import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Send, Sparkles, CheckCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useMarketplace } from '../../context/MarketplaceContext.tsx';
import { Booking, BookingMessage, UserRole } from '../../types/index.ts';
import { formatDateTimeNairobi, generateSafeId } from '../../lib/utils.ts';

interface BookingMessagesPanelProps {
  booking: Booking;
  viewerRole: UserRole;
}

export function BookingMessagesPanel({ booking, viewerRole }: BookingMessagesPanelProps) {
  const { firebaseUser, account, getIdToken } = useAuth();
  const { createNotification } = useMarketplace();
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bookings', booking.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BookingMessage, 'id'>),
        }));
        setMessages(list);

        // Mark incoming messages read
        for (const msg of list) {
          if (viewerRole === 'customer' && !msg.readByCustomer) {
            void updateDoc(doc(db, 'bookings', booking.id, 'messages', msg.id), {
              readByCustomer: true,
              readByProvider: msg.readByProvider,
            });
          } else if (viewerRole === 'provider' && !msg.readByProvider) {
            void updateDoc(doc(db, 'bookings', booking.id, 'messages', msg.id), {
              readByCustomer: msg.readByCustomer,
              readByProvider: true,
            });
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `bookings/${booking.id}/messages`)
    );
    return () => unsub();
  }, [booking.id, viewerRole]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !account || !draft.trim() || sending) return;
    setSending(true);
    const msgId = generateSafeId('msg');
    const body = draft.trim().slice(0, 2000);
    try {
      await setDoc(doc(db, 'bookings', booking.id, 'messages', msgId), {
        senderId: firebaseUser.uid,
        senderName: account.fullName || firebaseUser.displayName || 'User',
        senderRole: viewerRole,
        body,
        readByCustomer: viewerRole === 'customer',
        readByProvider: viewerRole === 'provider',
        createdAt: serverTimestamp(),
      });
      setDraft('');
      const recipientId = viewerRole === 'customer' ? booking.providerId : booking.customerId;
      await createNotification({
        userId: recipientId,
        title: `New message on ${booking.referenceCode}`,
        body: body.slice(0, 120),
        type: 'message',
        link: viewerRole === 'customer' ? '/provider/messages' : '/app/messages',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bookings/${booking.id}/messages/${msgId}`);
    } finally {
      setSending(false);
    }
  };

  const suggestReply = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const token = await getIdToken();
      const lastCustomerMsg = [...messages].reverse().find((m) => m.senderRole === 'customer')?.body || booking.jobDescription;
      const res = await fetch('/api/ai/provider-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: 'reply_suggestion',
          input: lastCustomerMsg,
          context: `Service: ${booking.serviceTitle}, Status: ${booking.status}, Date: ${booking.scheduledDate} ${booking.scheduledTime}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setDraft(data.text);
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[420px] bg-white border border-[#E6EAF0] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E6EAF0] flex items-center justify-between bg-[#F7F9FC]">
        <div>
          <div className="text-sm font-bold text-[#132238]">{booking.serviceTitle}</div>
          <div className="text-xs text-[#667085] font-mono-num">
            Ref {booking.referenceCode} · {viewerRole === 'customer' ? booking.providerName : booking.customerName}
          </div>
        </div>
        {viewerRole === 'provider' && (
          <button
            type="button"
            onClick={() => void suggestReply()}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAF0] bg-white text-xs font-medium text-[#132238] hover:border-[#0D9488]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
            {aiLoading ? 'Drafting...' : 'AI Draft Reply'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[#667085] text-center">
            No messages yet for {booking.referenceCode}. Send a note to coordinate job details or arrival time.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === firebaseUser?.uid;
            const isRead = viewerRole === 'customer' ? m.readByProvider : m.readByCustomer;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm ${
                    mine
                      ? 'bg-[#132238] text-white'
                      : 'bg-[#F7F9FC] border border-[#E6EAF0] text-[#182230]'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#98A2B3]">
                  <span>{m.senderName}</span>
                  <span>·</span>
                  <span>{formatDateTimeNairobi(m.createdAt)}</span>
                  {mine && isRead && <CheckCheck className="w-3.5 h-3.5 text-[#0D9488]" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-[#E6EAF0] flex items-center gap-2 bg-white">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </form>
    </div>
  );
}
