import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Router} from "@angular/router";
import {Subject} from "rxjs";
import SocketService, {ISocketMessage} from "./socket.service";
import {UserService} from "./user.service";


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

@Injectable({providedIn: 'root'})
export class GameService {
  private _currentRound?: IRoundState;
  private _userList: IUser[] = [];

  private _messageHanndlers: IMessageHandler = {
    'UpdatePlayers': (m) => {
      this._userList = m.data as IUser[];
      this._users.next(this._userList);
    },
    'ConfirmUsername': (m) => this._currentUser.next(m.data as IUser),
    'GameStarting': (m) => null, //this._roundState.next(true),
    'RoundStart': (m) => {
      this._currentRound = {
        video: m.data.videoId,
        videoStart: m.data.startTime,
        isOver: false,
        number: m.data.roundNumber,
        length: m.data.roundLength,
      };
      this._roundStart.next(this._currentRound);
    },
    'RoundEnd': (m) => {
      this._currentRound = {
        ...this._currentRound!,
        isOver: true,
        latitude: m.data.latitude,
        longitude: m.data.longitude,
      }
      this._roundEnd.next(this._currentRound);
    },
    'GameRunning': (m) => {
      this._currentRound = {
        isOver: false,
        video: m.data.videoId,
        videoStart: m.data.startTime,
        length: m.data.roundLength,
        number: 0,
      }
      this._roundState.next(this._currentRound);
    },
    'GuessResult': (m) => {
      this._currentRound = {
        ...this._currentRound!,
        result: m.data,
      }
      this._roundState.next(this._currentRound);
    },
    'BroadcastResult': (m) => {
      const user = this._userList.find(u => u.id === m.data.user.id);
      if (user) {
        user.points = m.data.user.points;
      }
      this._users.next(this._userList);
    }
  }

  public constructor(
    private _socket: SocketService,
    private _user: UserService,
    private _http: HttpClient,
    private _router: Router
  ) {
    this._socket.messages$.subscribe(message => {
      if (this._messageHanndlers[message.messageType] != null) {
        this._messageHanndlers[message.messageType](message);
      } else {
        console.info("Unknon message type");
        console.dir(message);
      }
    })
  }

  public createRoom() {
    let roomId: string = (Math.random() + 1).toString(36).substring(2)
    this._http
      .post(`/api/game/${roomId}`, null)
      .subscribe(() => {
        this._router.navigate([roomId]);
        this.connect(roomId)
      });
  }

  public get connected()
  {
    return this._socket.connected;
  }

  public connect(roomId: string) {
    this._socket.connect(`wss://localhost:7019/api/game/${roomId}?username=${this._user.username}&userId=${this._user.userId}`);
  }

  public startGame() {
    this._socket.sendMessage({messageType: 'StartGame', data: {}})
  }

  public sendGuess(lat: number, long: number, isFinal: boolean) {
    this._socket.sendMessage({messageType: 'Guess', data: {latitude: lat, longitude: long, isFinal}});
  }

  private _users = new Subject<IUser[]>();
  private _currentUser = new Subject<IUser>();
  private _roundState = new Subject<IRoundState>();
  private _roundStart = new Subject<IRoundState>();
  private _roundEnd = new Subject<IRoundState>();

  public readonly users$ = this._users.asObservable();
  public readonly currentUser$ = this._currentUser.asObservable();
  public readonly roundState$ = this._roundState.asObservable();
  public readonly roundStart$ = this._roundStart.asObservable();
  public readonly roundEnd$ = this._roundEnd.asObservable();
}
