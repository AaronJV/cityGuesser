import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';  // <<<< import it here

import { AppComponent } from './app.component';
import { GameComponent } from './game/game.component';
import { UserListComponent } from './user-list/user-list.component';
import { CircularProgressComponent } from './circular-progress/circular-progress.component';
import { NewRoomComponent } from './new-room/new-room.component';
import {AppRouterModule} from "./app-router.module";
import {GameContainerComponent} from "./game-container/game-container.component";

@NgModule({
  declarations: [
    AppComponent,
    UserListComponent,
    GameComponent,
    CircularProgressComponent,
    NewRoomComponent,
    GameContainerComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    AppRouterModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
