import { Component, OnInit } from "@angular/core";
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
        const params = `?autoplay=1&fs=0&mute=1&loop=1&color=white&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&start=${s.videoStart}`;

        const url = `https://www.youtube.com/embed/${s.video}${params}`;
        this.map.fitWorld();

        this.videoUrl = this._sanitizer.bypassSecurityTrustResourceUrl(url);
      } else {
        this.videoUrl = undefined;
      }
    });
    this._game.currentUser$.subscribe(u => this.currentUser = u);
  }

  public initMap() {
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
  }
}

