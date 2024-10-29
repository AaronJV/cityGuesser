import { Component } from '@angular/core';
import { GameService, IUser } from './game.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  public currentUser?: IUser;

  constructor(private _game: GameService) { }
}
