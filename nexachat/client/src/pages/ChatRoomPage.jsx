/**
 * Страница комнаты чата
 * Окно переписки с сообщениями
 */
export default function ChatRoomPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-24 h-24 rounded-full bg-secondary dark:bg-gray-700 flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-text-main dark:text-text-dark mb-2">
        Выберите чат
      </h2>
      <p className="text-text-muted dark:text-text-darkMuted max-w-md">
        Выберите чат из списка слева или начните новый, чтобы отправить сообщение
      </p>
    </div>
  );
}
