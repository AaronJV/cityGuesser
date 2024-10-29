import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {GameService} from "../game.service";

@Component({
  selector: 'app-game-container',
  template: `
    @if (connected) {
      <app-new-room></app-new-room>
    }
    @else {
      Game stuff here
      Connected: {{connected}}
    }
  `
})
export class GameContainerComponent {
  constructor(private _gameService: GameService, private _route: ActivatedRoute) {
  }
  public get connected() {
    return this._gameService.connected;
  }
}
