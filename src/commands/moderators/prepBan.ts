import { create_moderator_command } from '../../command';
import { Guild, Message, GuildMember, TextChannel, MessageAttachment } from 'discord.js';
import { getMuteRole } from './queries.queries';
import { PoolWrapper } from '../../db';

export const command = create_moderator_command(
    async ({ message, args, db }) => {
        const mentioned = message.mentions.members?.array();
        if (!message.guild) {
            return;
        }
        if (!mentioned || mentioned.length == 0) {
            await message.channel.send("can't prepare a ban without mentioning WHO to prepare for ban");
            return;
        }
        if (mentioned.length > 1) {
            await message.channel.send('I can only prepare 1 person at a time. Please only ping 1 person');
            return;
        }
        const personToBan = mentioned[0];
        const fut = addMuteRole(personToBan, message.guild, message.channel, db);
        const messageAmount = args.map((x) => Number(x)).find((x) => !isNaN(x));
        await fut;
        if (!messageAmount) {
            await message.channel.send('Could not get how many messages to store.');
            await fut;
            return;
        }
        const messages = await message.channel.messages.fetch({ before: message.id, limit: messageAmount }, true);
        const channel = message.guild.channels.cache.find((x) => x.name == 'ban-reason');
        const asString = messages
            .map((x) => {
                return {
                    date: x.createdAt,
                    authorName: x.author.username,
                    authorId: x.author.id,
                    content: x.content,
                };
            })
            .map(
                (partial) =>
                    `${partial.date.toDateString()} ${partial.authorName} (${partial.authorId}) : ${partial.content}`,
            )
            .join('\n-------\n');
        const asBuffer = Buffer.from(asString, 'utf-8');
        const attachment = new MessageAttachment(asBuffer, 'messages.txt');
        if (!channel) {
            await message.channel.send('Could not get the evidence channel');
            return;
        }
        //discord.js'es types can be improved....
        if (!((channel): channel is TextChannel => channel.type === 'text')(channel)) {
            await message.channel.send('Evidence channel is not a text channel');
            return;
        }
        channel.send({
            content: `${personToBan.user.username} ${personToBan.nickname} <@${personToBan.id}>`,
            files: [attachment],
        });
    },
    'Prepares someone to get banned by muting them and by copying the given amount of messages to the log channel',
    ['ban', 'prep_ban', 'prepban'],
);

const addMuteRole = async (to_mute: GuildMember, server: Guild, channel: Message['channel'], db: PoolWrapper) => {
    const role = await (async () => {
        const role = await getMuteRole.run({ server_id: server.id }, db).then((x) => x[0]?.mute_role);
        if (!role) {
            return server.roles.cache.find((x) => x.name == 'Muted');
        }
        return role;
    })();

    if (role) {
        await to_mute.roles.add(role);
    } else {
        await channel.send('Could not find mute role. Did not mute this person.');
    }
};
