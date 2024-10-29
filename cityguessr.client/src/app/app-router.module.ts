import { NgModule, Injectable, inject } from '@angular/core';
import { Routes, RouterModule, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router} from '@angular/router';
import {NewRoomComponent} from "./new-room/new-room.component";
import {GameContainerComponent} from "./game-container/game-container.component";
import {Observable} from 'rxjs';
import {GameService} from "./game.service";

const routes: Routes = [
  {path: '', component: NewRoomComponent},
  {path: ':roomId', component: GameContainerComponent, resolve: { connect: roomConnector}},
  {path: '**', redirectTo: ''},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRouterModule {
}

function roomConnector(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  const gameService = inject(GameService);

  if (!gameService.connected) {
    gameService.connect(route.paramMap.get('roomId')!);
  }
}

