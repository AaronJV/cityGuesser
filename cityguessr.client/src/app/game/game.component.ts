/// <reference types="youtube" />

import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { GameService, IRoundState, IUser } from "../game.service";
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as Leaflet from 'leaflet';
import { fromEvent, debounceTime } from "rxjs";


let marker: Leaflet.Marker | undefined = undefined;

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  public roundData?: IRoundState;
  public currentUser?: IUser;
  public videoUrl?: SafeResourceUrl;
  public map!: Leaflet.Map;
  @ViewChild('map') public mapElem?: ElementRef;
  private _player?: YT.Player;
  public playSpeed = 1;

  public showBigMap: boolean = false;

  private _doubleClicks: boolean[] = [];

  constructor(private _game: GameService, private _sanitizer: DomSanitizer) { }

  public ngOnInit() {
    this._game.roundState$.subscribe(s => {
      if (typeof (s) === 'boolean') {
        this.initMap();
        return;
      }
      this.roundData = s;
      if (!s.isOver) {
        if (!this.map) {
          this.initMap();
        }
        if (!this._player) {
          this.initYoutube(s.video, s.videoStart);
        } else {
          this._player.loadVideoById(s.video, s.videoStart);
        }

        this.map?.fitWorld();
      } else {
        this.videoUrl = undefined;
      }
    });
    this._game.currentUser$.subscribe(u => this.currentUser = u);
  }

  public updateSpeed() {
    console.log(this.playSpeed)
    this._player?.setPlaybackRate(this.playSpeed);
  }


  public seekBack(gotoStart: boolean) {
    let time = this.roundData?.videoStart ?? 0;

    if (!gotoStart) {
      const current = this._player?.getCurrentTime() ?? 0;
      time = Math.max(time, current - 5);
    }

    this._player?.seekTo(time, true);
  }

  private initYoutube(videoId: string, start: number) {
    const tag = document.createElement('script');

    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);

    (<any>window).onYouTubeIframeAPIReady = () => {
      this._player = new YT.Player('video', {
        height: "100%",
        width: "100%",
        videoId,
        events: {
          'onReady': console.dir,
          'onStateChange': (e: any) => {
            console.log('state change');
            console.dir(e)
          }
        },
        playerVars:
        {
          autoplay: 1,
          fs: 0,
          mute: 1,
          loop: 1,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          start,
        }
      });
    }
  }

  public initMap() {
    if (!this.mapElem) {
      return;
    }
    this.map = Leaflet.map('map');
    this.map.fitWorld();
    Leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(this.map);
    fromEvent<Leaflet.LeafletMouseEvent>(this.map, 'click')
      .pipe(debounceTime(200))
      .subscribe((event) => {
        if (this._doubleClicks.length === 0) {
          this.onMapClick(event);
        }
      })
    this.map.on('dblclick', () => {
      this._doubleClicks.push(true);
      setTimeout(() => {
        this._doubleClicks.pop();
      }, 250)
    });
    var resize = new ResizeObserver(() => {
      this.map.invalidateSize()
      this.map.fitWorld();
    });
    resize.observe(this.mapElem?.nativeElement)
  }

  public startGame() {
    this._game.startGame();
  }

  public onMapClick(e: Leaflet.LeafletMouseEvent) {
    if (marker) {
      marker.setLatLng(e.latlng);
    }
    else {
      marker = Leaflet.marker(e.latlng);
      marker.addTo(this.map);
    }
  }

  public swap() {
    this.showBigMap = !this.showBigMap;
    this.map.invalidateSize();
  }
}

