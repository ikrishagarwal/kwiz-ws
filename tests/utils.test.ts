import { beforeEach, describe, expect, it } from "vitest";
import {
  checkAttendee,
  checkOrganizer,
  roomExists,
  isUniqueUserId,
} from "#root/utils";
import { StateType } from "#root/structures";

describe("Check Attendee/Organizer Functions", () => {
  it("should return true if role is attendee", () => {
    expect(checkAttendee("attendee")).toBe(true);
  });

  it("should return false if role is not attendee", () => {
    expect(checkAttendee("organizer")).toBe(false);
  });

  it("should return true if role is organizer", () => {
    expect(checkOrganizer("organizer")).toBe(true);
  });

  it("should return false if role is not organizer", () => {
    expect(checkOrganizer("attendee")).toBe(false);
  });
});

describe("Room Exists Function", () => {
  it("should return true if room exists", () => {
    expect(roomExists(["room1", "room2"], "room1")).toBe(true);
  });

  it("should return false if room does not exist", () => {
    expect(roomExists(["room1", "room2"], "room3")).toBe(false);
  });

  it("should return false if rooms array is empty", () => {
    expect(roomExists([], "room1")).toBe(false);
  });
});

describe("Unique User ID Function", () => {
  it("should return true if user ID is unique", () => {
    const state: StateType = {
      rooms: {
        room1: {
          attendees: [
            { id: "user1", username: "user1" },
            { id: "user2", username: "user2" },
          ],
          organizer: "",
          scores: [],
          question: "",
          answers: [],
        },
        room2: {
          attendees: [
            { id: "user3", username: "user3" },
            { id: "user4", username: "user4" },
          ],
          organizer: "",
          scores: [],
          question: "",
          answers: [],
        },
      },
      traffic: 4,
    };
    expect(isUniqueUserId(state, "user5")).toBe(true);
  });

  it("should return false if user ID is not unique", () => {
    const state: StateType = {
      rooms: {
        room1: {
          attendees: [
            { id: "user1", username: "user1" },
            { id: "user2", username: "user2" },
          ],
          organizer: "",
          scores: [],
          question: "",
          answers: [],
        },
        room2: {
          attendees: [
            { id: "user3", username: "user3" },
            { id: "user4", username: "user4" },
          ],
          organizer: "",
          scores: [],
          question: "",
          answers: [],
        },
      },
      traffic: 4,
    };
    expect(isUniqueUserId(state, "user2")).toBe(false);
  });

  it("should return true if there are no rooms", () => {
    const state: StateType = {
      rooms: {},
      traffic: 0,
    };
    expect(isUniqueUserId(state, "user1")).toBe(true);
  });
});
