import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

@Injectable({ providedIn: 'root' })
export default class SocketService {
  private _socket?: WebSocket;
  private _messgeSubject = new Subject<ISocketMessage>();
  public messages$ = this._messgeSubject.asObservable();

  public connect(url: string) {
    this._socket = new WebSocket(url);
    this._socket.addEventListener("open", ev => {
      console.dir('open', ev);
    });
    this._socket.addEventListener("message", ev => {
      var message: ISocketMessage = JSON.parse(ev.data);
      this._messgeSubject.next(message);
    });
    this._socket.addEventListener("close", ev => {
      console.dir(ev);
    });
  }

  public sendMessage(message: ISocketMessage) {
    if (!this._socket || this._socket.readyState != WebSocket.OPEN) {
      console.error('No open connection');
      return;
    }

    this._socket.send(JSON.stringify(message));
  }
}

export interface ISocketMessage {
  messageType: string;
  data: any;
}
