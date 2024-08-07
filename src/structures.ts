import type WebSocket from "ws";

export enum ErrorMessages {
  InvalidData = "Received invalid JSON data.",
  InvalidRequest = "Request type is invalid.",

  WrongDesignationHosting = "This designation does not support hosting rooms.",
  WrongDesignationRegistration = "This designation does not support user registration.",
  WrongDesignationSubmission = "This designation does not support answer submission.",
  WrongDesignationAnswer = "This designation does not support answering questions.",
  WrongDesignationAddingQuestions = "This designation does not support adding questions.",

  InvalidRoomId = "Room ID is invalid.",
  InvalidUserId = "User ID is invalid.",

  DuplicateRoom = "Room already exists.",
  DuplicateUser = "User already exists.",

  InvalidRoom = "Room does not exist.",

  EmptyQuestion = "Question cannot be empty.",
  InvalidOptions = "Options are invalid.",
  InvalidAnswer = "Answer index is invalid.",
  NoQuestion = "No questions found.",
}

export enum SuccessMessages {
  RoomCreated = "Successfully hosted a room.",
  UserCreated = "Successfully registered a user.",

  AnswerSubmitted = "Successfully submitted the answer.",
}

export enum Actions {
  AddQuestion = "add_question",
  SubmitAnswer = "submit_answer",
}

export enum ActionMessages {
  AddQuestion = "Successfully added a question.",
  SubmitAnswer = "Successfully submitted your answer.",
}

export enum RequestType {
  HOST_ROOM = "host_room",
  REGISTER_USER = "register_user",
  ADD_QUESTION = "add_question",
  SUBMIT_ANSWER = "submit_answer",
  ANSWER = "answer",
  LOG = "log",
}

export type WSExtended = WebSocket & {
  data: { roomId: string; userId: string; username: string };
};

export type StateType = {
  traffic: number;
  rooms: Record<
    string,
    {
      organizer: string;
      attendees: Array<{ id: string; username: string }>;
      scores: Array<{ id: string; score: number; username: string }>;
      question: string;
      answers: Array<{ userId: string; answer: number }>;
    }
  >;
};
