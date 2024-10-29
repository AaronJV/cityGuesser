import {Injectable} from "@angular/core";
import * as uuid from "uuid";
import { generateName } from "./name-generator";

const USER_ID_KEY = 'user_id';
const USERNAME_KEY = 'username';

@Injectable({providedIn: 'root'})
export class UserService {
  private _id: string;
  private _username: string;

  public get userId() {
    return this._id;
  }

  public get username() {
    return this._username;
  }

  constructor() {
    let userId = localStorage.getItem(USER_ID_KEY);

    if (!userId) {
      userId = uuid.v4();
      localStorage.setItem(USER_ID_KEY, userId);
    }

    this._id = userId;

    let username = localStorage.getItem(USERNAME_KEY);

    if (!username) {
      username = generateName()
      localStorage.setItem(USERNAME_KEY, username);
    }

    this._username = username;
  }
}
