import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {GameService} from "../game.service";

@Component({
  selector: 'app-new-room',
  templateUrl: './new-room.component.html',
  styleUrls: ['./new-room.component.css']
})
export class NewRoomComponent implements OnInit, OnDestroy {
  private _sub?: Subscription;
  constructor(private _route: ActivatedRoute, private _game: GameService) { }

  ngOnInit() {
    this._sub = this._route.params.subscribe(params => {
      console.log(params['roomId']);
    });
  }

  ngOnDestroy() {
    this._sub?.unsubscribe();
  }

  createRoom() {
    this._game.createRoom();
  }
}
