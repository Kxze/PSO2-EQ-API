import twit from "twit";
import moment from "moment-timezone";
import config from "./config";
import { EventEmitter } from "events";

class Scraper {

    private twitter = new twit(config.twitter);
    private eventEmitter = new EventEmitter();
    private patterns = {
        upcoming: /^(\d+)時\s(.+)/gm,
        inProgress: /【開催中】\d+(.+)/gm,
    };
    
    private async getEQs(): Promise<Response> {
        const tweets = await this.twitter.get("statuses/user_timeline", { screen_name: "pso2_emg_hour", count: 1 });
        const data = tweets.data as Tweet[];
        const tweet = data[0];

        const creation_date = this.parseTwitterDate(tweet.created_at);

        const inProgress = this.getInProgressQuest(tweet.created_at, tweet.text);
        const upcoming = this.getUpcomingQuests(tweet.created_at, tweet.text);

        return {
            date: {
                JP: creation_date.tz("Asia/Tokyo").toString(),
                UTC: creation_date.utc().toString(),
            },
            inProgress,
            upcoming,
        }
    }

    private getInProgressQuest(tweetDate: string, text: string): Quest {
        const match = [ ...text.matchAll(this.patterns.upcoming) ][0];

        const hour = parseInt(match[1], 10);
        const name = match[2];

        return {
            name,
            hour: this.getHour(tweetDate, hour),
        }
    }

    private getUpcomingQuests(tweetDate: string, text: string): Quest[] {
        const matches = text.matchAll(this.patterns.upcoming);
        const quests: Quest[] = [];

        for (let match of matches) {
            let hour = parseInt(match[1], 10);
            let name = match[2];

            quests.push({
                name,
                hour: this.getHour(tweetDate, hour),
            });
        }

        return quests;
    }

    private parseTwitterDate(text: string): moment.Moment {
        return moment(text, "ddd MMM DD HH:mm:ss ZZ YYYY").utc();
    }

    private getHour(tweetDate: string, hour: number): Date {
        const tweetMoment = this.parseTwitterDate(tweetDate);
        let jpDate = tweetMoment.tz("Asia/Tokyo");

        if (hour > tweetMoment.get("hour")) {
            jpDate = jpDate.add(1, "day");
        }

        return {
            JP: jpDate.toString(),
            UTC: jpDate.utc().toString(),
        }
    }

    private async findEQ() {
        console.log("Finding EQs...");
        const response = await this.getEQs();

        console.log(response);
    }

    public startPolling(interval = 10000) {
        console.log("Starting poll loop");
        setInterval(this.findEQ.bind(this), interval);
    }

}

type Date = {
    JP: string;
    UTC: string;
}

type Tweet = {
    created_at: string;
    id: number;
    text: string;
    truncated: boolean;
}

type Response = {
    date: Date,
    inProgress?: Quest,
    upcoming: Quest[]
}

type Quest = {
    name: string;
    hour: Date;
}

export default Scraper;
