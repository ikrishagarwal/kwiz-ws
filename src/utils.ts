import type { StateType } from "#root/structures";

export const checkOrganizer = (role: string) => role === "organizer";
export const checkAttendee = (role: string) => role === "attendee";

export const roomExists = (rooms: string[], roomId: string) =>
  rooms.includes(roomId);

export const isUniqueUserId = (state: StateType, userId: string) => {
  for (const roomId in state.rooms) {
    const attendees = state.rooms[roomId].attendees;
    for (const attendee of attendees) {
      if (attendee.id === userId) return false;
    }
  }
  return true;
};
