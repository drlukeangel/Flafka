import type { ConceptContent } from '../../types/learn';

export const eventTimeWatermarksContent: ConceptContent = {
  animation: 'watermark',
  sections: [
    {
      heading: 'Two Flavors of Time',
      body: 'In stream processing, time is not as simple as checking your watch. Processing time is the wall-clock time when Flink actually handles a record. Event time is the timestamp baked into the event itself, representing when it actually happened in the real world. These two can diverge wildly due to network delays, buffering, or your upstream system having a bad day. For anything analytically meaningful, event time is almost always what you want.',
    },
    {
      heading: 'Watermarks: Flink\'s Progress Tracker',
      body: 'A watermark is a timestamp that flows through your pipeline alongside your data, asserting that all events up to that point in time have arrived. When a window operator sees a watermark past its window boundary, it knows the window is complete and fires the results. Without watermarks, Flink would sit there forever waiting for stragglers that might never come. Watermarks are how Flink turns the chaos of out-of-order event streams into orderly, timely output.',
    },
    {
      heading: 'Out-of-Order Events and Late Data',
      body: 'Events do not always arrive in the order they occurred. A record timestamped at 2:00 PM might show up after a record timestamped at 2:03 PM. Watermarks handle this by building in a tolerance window. If your watermark trails 5 seconds behind the latest event time, any event arriving within that 5-second buffer still gets processed correctly. Events arriving after the watermark has passed their timestamp are considered late and are dropped by default. Choosing the right delay is a balancing act between tolerating lateness and delivering timely results.',
    },
    {
      heading: 'WATERMARK FOR in CREATE TABLE',
      body: 'You declare watermarks in your Flink SQL table DDL using the WATERMARK FOR clause. The syntax looks like WATERMARK FOR event_time AS event_time - INTERVAL \'5\' SECOND, which tells Flink to use the event_time column for event-time semantics and trail watermarks 5 seconds behind the maximum observed value. On Confluent Cloud, you set this when creating your table, and Flink propagates watermarks correctly through joins, unions, and every other operator downstream.',
    },
    {
      heading: 'Tuning for the Real World',
      body: 'Picking the right watermark delay means understanding your data. If your events typically arrive within a couple seconds of their timestamp, a 5-second delay is generous. If you are ingesting from external partners or batch imports, you might need minutes of slack. A bigger delay means more late events get included but your results take longer to appear. A smaller delay means faster results but more dropped stragglers. There is no universal right answer, just the right answer for your data.',
    },
  ],
};
