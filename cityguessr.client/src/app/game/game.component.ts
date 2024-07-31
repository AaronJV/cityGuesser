/// <reference types="youtube" />

import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { GameService, IRoundState, IUser } from "../game.service";
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as Leaflet from 'leaflet';
import { fromEvent, debounceTime } from "rxjs";


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
  public marker?: Leaflet.Marker;
  private _resultMarker?: Leaflet.Marker;


  public showBigMap: boolean = false;

  private _doubleClicks: boolean[] = [];

  constructor(public game: GameService) { }

  public ngOnInit() {
    this.game.roundState$.subscribe(s => {
      if (typeof (s) === 'boolean') {
        this.initMap();
        return;
      }
      this.roundData = s;
      if (this.roundData?.video !== s.video && this._resultMarker)
      {
        this._resultMarker.remove();
        delete this._resultMarker;
      }
      if (s.result)
      {
        this._resultMarker = Leaflet.marker([s.result.targetLatitude, s.result.targetLongitude]);
        this._resultMarker.addTo(this.map);

        Leaflet.polyline(
          [this._resultMarker.getLatLng(), this.marker!.getLatLng()], {
          weight: 10,
          dashArray: '10, 10',
          color: 'black'
        }).addTo(this.map);
      }
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
    this.game.currentUser$.subscribe(u => this.currentUser = u);
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
    this.game.startGame();
  }

  public onMapClick(e: Leaflet.LeafletMouseEvent) {
    if (this._resultMarker)
    {
      return;
    }

    if (this.marker) {
      this.marker.setLatLng(e.latlng);
    }
    else {
      this.marker = Leaflet.marker(e.latlng);
      this.marker.addTo(this.map);
    }
    this.game.sendGuess(e.latlng.lat, e.latlng.lng, false);
  }

  public finalizeGuess() {
    if (!this.marker) {
      return
    }

    const latLng = this.marker.getLatLng();

    this.game.sendGuess(latLng.lat, latLng.lng, true);
  }

  public swap() {
    this.showBigMap = !this.showBigMap;
    this.map.invalidateSize();
  }
}

