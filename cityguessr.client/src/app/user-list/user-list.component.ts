import { Component, OnInit } from "@angular/core";
import { GameService, IUser } from "../game.service";

@Component({
  selector: 'app-userList',
  templateUrl: './user-list.component.html',
  styles: ['.current { font-weight: bold; }']
})
export class UserListComponent implements OnInit {
  public currentUser?: IUser;
  public users: IUser[] = [];
  constructor(private _game: GameService) { }

  public ngOnInit() {
    this._game.currentUser$.subscribe(u => this.currentUser = u);
    this._game.users$.subscribe(users => this.users = users);
  }
}
