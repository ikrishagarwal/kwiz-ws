use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Extension, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use shuttle_axum::ShuttleAxum;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::services::ServeDir;

#[shuttle_runtime::main]
async fn main() -> ShuttleAxum {
    // Create a shared state
    let state = Arc::new(Mutex::new(State {
        traffic: 0,
        rooms: vec![],
        users: vec![],
    }));

    // Create a new router
    let router = Router::new()
        .route("/ws", get(websocket_handler))
        .nest_service("/", ServeDir::new("static"))
        .layer(Extension(state));

    Ok(router.into())
}

// upgrade the connection to a websocket
async fn websocket_handler(
    ws: WebSocketUpgrade,
    Extension(state): Extension<Arc<Mutex<State>>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket(socket, state))
}

// handle the websocket connection
async fn websocket(socket: WebSocket, state: Arc<Mutex<State>>) {
    let (mut sender, mut receiver) = socket.split();
    state.lock().await.traffic += 1;
    while let Some(Ok(msg)) = receiver.next().await {
        let msg_str = match msg {
            Message::Text(text) => text,
            Message::Binary(_) => {
                eprintln!("error: expected text message, received binary message");
                continue;
            }
            Message::Ping(_) => {
                eprintln!("error: received Ping message");
                continue;
            }
            Message::Close(_) => {
                eprintln!("error: received Close message");
                continue;
            }
            Message::Pong(_) => {
                eprintln!("error: received Pong message");
                continue;
            }
        };

        // deserialize the message from string
        let data = match serde_json::from_str::<Request>(&msg_str) {
            Ok(message) => message,
            Err(e) => {
                sender
                    .send(Message::Text(
                        serde_json::to_string(&ErrorResponse {
                            error: e.to_string(),
                        })
                        .unwrap(),
                    ))
                    .await
                    .unwrap();
                eprintln!("error deserializing message: {}", e);
                continue;
            }
        };

        // use switch case to match request types and process
        match data.request_type {
            // handle RegisterUser request
            RequestType::RegisterUser => {
                let user = match data.data {
                    RequestData::RegisterUser(user) => user,
                    _ => {
                        // send ErrorResponse
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "expected RegisterUser data, received something else"
                                        .to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: expected RegisterUser data, received something else");
                        continue;
                    }
                };
                state.lock().await.users.push(user.clone());
                // send response
                sender
                    .send(Message::Text(serde_json::to_string(&user.clone()).unwrap()))
                    .await
                    .unwrap();
            }

            // handle HostRoom request
            RequestType::HostRoom => {
                let room_request = match data.data {
                    RequestData::HostRoom(room_request) => room_request,
                    _ => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "expected HostRoom data, received something else"
                                        .to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: expected HostRoom data, received something else");
                        continue;
                    }
                };
                // only allow if has role of organizer
                let local_state = state.clone();
                let locked_state = local_state.lock().await;
                let user = locked_state
                    .users
                    .iter()
                    .find(|user| user.name == room_request.user);
                // .users.iter().find(|user| user.name == room_request.user);
                match user {
                    Some(user) => {
                        if user.role != Role::Organizer {
                            sender
                                .send(Message::Text(
                                    serde_json::to_string(&ErrorResponse {
                                        error: "user is not the organizer".to_string(),
                                    })
                                    .unwrap(),
                                ))
                                .await
                                .unwrap();
                            eprintln!("error: user is not the organizer");
                            continue;
                        }
                    }
                    None => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "user not found".to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: user not found");
                        continue;
                    }
                }
                let room = Room {
                    id: room_request.room_id.clone(),
                    users: vec![],
                    questions: vec![],
                    answers: vec![],
                };
                state.lock().await.rooms.push(room.clone());
                // send response
                sender
                    .send(Message::Text(
                        serde_json::to_string(&RoomResponse {
                            room_id: room.id.clone(),
                        })
                        .unwrap(),
                    ))
                    .await
                    .unwrap();
            }

            // handle JoinRoom request
            RequestType::JoinRoom => {
                let room_request = match data.data {
                    RequestData::JoinRoom(room_request) => room_request,
                    _ => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "expected JoinRoom data, received something else"
                                        .to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: expected JoinRoom data, received something else");
                        continue;
                    }
                };
                let mut locked_state = state.lock().await;
                let room = locked_state
                    .rooms
                    .iter_mut()
                    .find(|room| room.id == room_request.room_id);
                match room {
                    Some(room) => {
                        let locked_state = state.lock().await;
                        let user = locked_state
                            .users
                            .iter()
                            .find(|user| user.name == room_request.user);
                        match user {
                            Some(user) => {
                                room.users.push(user.clone());
                                // send response
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&RoomResponse {
                                            room_id: room.id.clone(),
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                            }
                            None => {
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&ErrorResponse {
                                            error: "user not found".to_string(),
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                                eprintln!("error: user not found");
                            }
                        }
                    }
                    None => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "room not found".to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: room not found");
                    }
                }
            }

            // handle AddQuestions request
            RequestType::AddQuestions => {
                let add_questions_request = match data.data {
                    RequestData::AddQuestions(add_questions_request) => add_questions_request,
                    _ => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "expected AddQuestions data, received something else"
                                        .to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: expected AddQuestions data, received something else");
                        continue;
                    }
                };
                let mut rooms = state.lock().await.rooms.clone();
                let room = {
                    rooms
                        .iter_mut()
                        .find(|room| room.id == add_questions_request.room_id)
                };
                match room {
                    Some(room) => {
                        // check if the user is the organizer
                        let organizer = room.users.iter().find(|user| user.role == Role::Organizer);
                        match organizer {
                            Some(_) => {
                                // add questions to the room
                                let questions = add_questions_request.questions;
                                room.questions.extend(questions.clone());
                                // send response
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&AddQuestionsResponse {
                                            room_id: room.id.clone(),
                                            questions,
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                            }
                            None => {
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&ErrorResponse {
                                            error: "user is not the organizer".to_string(),
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                                eprintln!("error: user is not the organizer");
                            }
                        }
                    }
                    None => {
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "room not found".to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                        eprintln!("error: room not found");
                    }
                }
            }

            // handle AnswerQuestion request
            RequestType::AnswerQuestion => {
                let answer_question_request = match data.data {
                    RequestData::AnswerQuestion(answer_question_request) => answer_question_request,
                    _ => {
                        eprintln!("error: expected AnswerQuestion data, received something else");
                        continue;
                    }
                };
                let mut rooms = state.lock().await.rooms.clone();
                let room = rooms
                    .iter_mut()
                    .find(|room| room.id == answer_question_request.room_id);
                match room {
                    Some(room) => {
                        let user = room
                            .users
                            .iter()
                            .find(|user| user.name == answer_question_request.user);
                        match user {
                            Some(_) => {
                                // add questions to the room
                                let question = answer_question_request.question_id;
                                let answer = answer_question_request.answer;
                                room.answers.push(Answer {
                                    user: answer_question_request.user.clone(),
                                    question_id: question,
                                    answer,
                                });
                                // send response
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&AnswerQuestionResponse {
                                            room_id: room.id.clone(),
                                            question_id: question,
                                            answer,
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                            }
                            None => {
                                eprintln!("error: user not found");
                                sender
                                    .send(Message::Text(
                                        serde_json::to_string(&ErrorResponse {
                                            error: "user not found".to_string(),
                                        })
                                        .unwrap(),
                                    ))
                                    .await
                                    .unwrap();
                            }
                        }
                    }
                    None => {
                        eprintln!("error: room not found");
                        sender
                            .send(Message::Text(
                                serde_json::to_string(&ErrorResponse {
                                    error: "room not found".to_string(),
                                })
                                .unwrap(),
                            ))
                            .await
                            .unwrap();
                    }
                }
            }
        }
    }

    // This client disconnected
    state.lock().await.traffic -= 1;
}

// State
#[derive(Serialize, Deserialize, Debug)]
struct State {
    users: Vec<User>,
    rooms: Vec<Room>,
    traffic: usize,
}

// User
#[derive(Serialize, Deserialize, Debug, Clone)]
struct User {
    name: String,
    role: Role,
}

// Room
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Room {
    id: String,
    users: Vec<User>,
    questions: Vec<Question>,
    answers: Vec<Answer>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Answer {
    user: String,
    question_id: i32,
    answer: i32,
}

// Role
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
enum Role {
    #[serde(rename = "organizer")]
    Organizer,
    #[serde(rename = "attendee")]
    Attendee,
}

impl PartialEq for Role {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Role::Organizer, Role::Organizer) => true,
            (Role::Attendee, Role::Attendee) => true,
            _ => false,
        }
    }
}

// Request Data
#[derive(Serialize, Deserialize, Debug)]
enum RequestData {
    RegisterUser(User),
    HostRoom(RoomRequest),
    JoinRoom(RoomRequest),
    AddQuestions(AddQuestionsRequest),
    AnswerQuestion(AnswerQuestionRequest),
}

// Request types
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
enum RequestType {
    #[serde(rename = "register_user")]
    RegisterUser,
    #[serde(rename = "host_room")]
    HostRoom,
    #[serde(rename = "join_room")]
    JoinRoom,
    #[serde(rename = "add_questions")]
    AddQuestions,
    #[serde(rename = "answer_question")]
    AnswerQuestion,
}

// Final request and response structs
#[derive(Serialize, Deserialize, Debug)]
struct Request {
    data: RequestData,
    request_type: RequestType,
}

// Requests
#[derive(Serialize, Deserialize, Debug)]
struct RoomRequest {
    user: String,
    room_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct AddQuestionsRequest {
    user: String,
    room_id: String,
    questions: Vec<Question>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Question {
    id: String,
    question: String,
    options: Vec<String>,
    answer: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct AnswerQuestionRequest {
    user: String,
    room_id: String,
    question_id: i32,
    answer: i32,
}

// Responses
#[derive(Serialize, Deserialize, Debug)]
struct AddQuestionsResponse {
    room_id: String,
    questions: Vec<Question>,
}

#[derive(Serialize, Deserialize, Debug)]
struct AnswerQuestionResponse {
    room_id: String,
    question_id: i32,
    answer: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct RoomResponse {
    room_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct ErrorResponse {
    error: String,
}
