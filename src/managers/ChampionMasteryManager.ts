import type { BaseManager, ChampionMasteryData } from "../types";
import type { Client } from "../client";
import Collection from "@discordjs/collection";
import { Champion, ChampionMastery } from "../structures";

/**
 * A champion master manager - to fetch and manage all summoner's champion mastery data.
 */
export class ChampionMasteryManager implements BaseManager<ChampionMastery> {
  /**
   * The cached mastery data for the summoner.
   */
  readonly cache: Collection<string, ChampionMastery>;
  /**
   * The client this manager belongs to.
   */
  readonly client: Client;
  /**
   * The ID of the summoner whose mastery is managed by this manager.
   */
  readonly summonerId: string;

  constructor(client: Client, summoner: string) {
    this.client = client;
    this.summonerId = summoner;
    this.cache = new Collection<string, ChampionMastery>();
    this._totalScore = 0;
  }

  private _totalScore: number;

  /**
   * The total mastery score of this summoner.
   */
  get totalScore() {
    return this._totalScore;
  }

  /**
   * Fetch a champion's mastery data for the summoner.
   *
   * @param champion The champion (or its ID) whose mastery data needs to be fetched.
   * @param options The basic fetching options.
   */
  fetch(champion: Champion | string, options: { force: boolean } = { force: false }): Promise<ChampionMastery> {
    const id = champion instanceof Champion ? champion.id : champion;
    return new Promise(async (resolve, reject) => {
      const champ = await this.client.champions.fetch(id).catch(() => undefined);
      if (!champ) reject('Invalid champion ID');
      else if (this.cache.has(champ.id) && !options.force) resolve(this.cache.get(id)!);
      else {
        const response = await this.client.api
          .makeApiRequest(
            `/lol/champion-mastery/v4/champion-masteries/by-summoner/${this.summonerId}/by-champion/${champ.key}`,
            {
              regional: false,
              name: 'Champion mastery by champion',
              params: `Summoner ID: ${this.summonerId}, Champion ID: ${champ.key}`
            }
          )
          .catch(reject);
        if (response) {
          const data = <ChampionMasteryData>response.data;
          const mastery = new ChampionMastery(this.client, data);
          this.cache.set(champ.id, mastery);
          resolve(mastery);
        }
      }
    });
  }

  /**
   * Update the cache with the latest data for all champions' mastery data for this summoner.
   */
  refreshAll() {
    return new Promise(async (resolve, reject) => {
      const response = await this.client.api
        .makeApiRequest(`/lol/champion-mastery/v4/champion-masteries/by-summoner/${this.summonerId}`, {
          regional: false,
          name: 'Champion mastery by summoner',
          params: `Summoner ID: ${this.summonerId}`
        })
        .catch(reject);
      if (response) {
        const dataList = <ChampionMasteryData[]>response.data;
        for (const data of dataList) {
          const mastery = new ChampionMastery(this.client, data);
          this.cache.set(mastery.champion.id, mastery);
        }
        resolve(this.cache);
      }
    });
  }

  /**
   * Get an updated total mastery score for this summoner.
   */
  updateTotalScore() {
    return new Promise(async (resolve, reject) => {
      const response = await this.client.api
        .makeApiRequest(`/lol/champion-mastery/v4/scores/by-summoner/${this.summonerId}`, {
          regional: false,
          name: 'Champion mastery score by summoner',
          params: `Summoner ID: ${this.summonerId}`
        })
        .catch(reject);
      if (response) {
        const score = <number>response.data;
        this._totalScore = score;
        resolve(score);
      }
    });
  }
}
