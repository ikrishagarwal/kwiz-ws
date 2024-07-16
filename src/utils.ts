export const checkOrganizer = (role: string) => role === "organizer";
export const checkAttendee = (role: string) => role === "attendee";

export const roomExists = (rooms: string[], roomId: string) =>
  rooms.includes(roomId);
