import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { GameService, IUser } from './game.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  public currentUser?: IUser;

  constructor(private _game: GameService) { }

  ngOnInit() {
    this._game.connect();
  }
}
