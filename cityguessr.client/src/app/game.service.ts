import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import SocketService, { ISocketMessage } from "./socket.service";


export interface IUser {
  name: string;
  points: number;
  id: string;
  isHost: boolean;
}

interface IMessageHandler {
  [type: string]: (message: ISocketMessage) => void;
}

export interface IRoundState {
  video: string;
  videoStart: number;
  isOver: boolean;
  length: number;
  number: number;
  latitude?: number;
  longitude?: number;
  result?: {
    distance: number;
    targetLatitude: number;
    targetLongitude: number;
  }
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private _socket: SocketService;
  private _currentRound?: IRoundState;

  private _messageHanndlers: IMessageHandler = {
    'UpdatePlayers': (m) => this._users.next(m.data as IUser[]),
    'ConfirmUsername': (m) => this._currentUser.next(m.data as IUser),
    'GameStarting': (m) => this._roundState.next(true),
    'RoundStart': (m) => {
      this._currentRound = {
        video: m.data.videoId,
        videoStart: m.data.startTime,
        isOver: false,
        number: m.data.roundNumber,
        length: m.data.roundLength,
      };
      this._roundState.next(this._currentRound);
    },
    'RoundEnd1': (m) => {
      this._currentRound = {
        ...this._currentRound!,
        isOver: true,
        latitude: m.data.latitude,
        longitude: m.data.longitude,
      }
      this._roundState.next(this._currentRound);
    },
    'GameRunning': (m) => {
      this._currentRound = {
        isOver: false,
        video: m.data.videoId,
        videoStart: m.data.startTime,
        number: 0,
        length: 0,
      }
      this._roundState.next(this._currentRound);
    },
    'GuessResult': (m) => {
      this._currentRound = {
        ...this._currentRound!,
        result: m.data,
      }
      this._roundState.next(this._currentRound);
    }
  }

  public constructor(socketService: SocketService) {
    this._socket = socketService;
    this._socket.messages$.subscribe(message => {
      if (this._messageHanndlers[message.messageType] != null) {
        this._messageHanndlers[message.messageType](message);
      }
      else {
        console.info("Unknon message type");
        console.dir(message);
      }
    })
  }

  public connect() {
    this._socket.connect("wss://localhost:7019/ws");
  }

  public startGame() {
    this._socket.sendMessage({ messageType: 'StartGame', data: {} })
  }

  public sendGuess(lat: number, long: number, isFinal: boolean) {
    this._socket.sendMessage({ messageType: 'Guess', data: { latitude: lat, longitude: long, isFinal } });
  }

  private _users = new Subject<IUser[]>();
  private _currentUser = new Subject<IUser>();
  private _roundState = new Subject<IRoundState | true>();

  public readonly users$ = this._users.asObservable();
  public readonly currentUser$ = this._currentUser.asObservable();
  public readonly roundState$ = this._roundState.asObservable();
}
