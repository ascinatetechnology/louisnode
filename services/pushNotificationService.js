export const sendPushNotification = async ({
  userId,
  pushTokens = [],
  title,
  body,
  data = {},
}) => {
  const validPushTokens = (pushTokens || []).filter((token) =>
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );

  if (validPushTokens.length === 0) {
    return {
      delivered: false,
      user_id: userId,
      title,
      body,
      data,
      reason: "No active Expo push tokens found",
    };
  }

  const messages = validPushTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const headers = {
    Accept: "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };

  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData?.errors?.[0]?.message || "Expo push send failed");
  }

  return {
    delivered: true,
    user_id: userId,
    ticket_count: responseData?.data?.length || 0,
    tickets: responseData?.data || [],
  };
};
