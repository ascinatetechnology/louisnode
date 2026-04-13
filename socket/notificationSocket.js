let notificationIo = null;

export const registerNotificationSocket = (io) => {
  notificationIo = io;

  io.on("connection", (socket) => {
    socket.on("join_notifications", ({ user_id }) => {
      if (!user_id) return;

      socket.join(`notifications:${user_id}`);
      socket.emit("joined_notifications", { user_id });
    });

    socket.on("leave_notifications", ({ user_id }) => {
      if (!user_id) return;

      socket.leave(`notifications:${user_id}`);
    });
  });
};

export const emitNotificationToUser = (userId, notification) => {
  if (!notificationIo || !userId || !notification) return;

  notificationIo
    .to(`notifications:${userId}`)
    .emit("notification_received", notification);
};
