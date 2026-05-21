import { Request, Response } from 'express';
import prisma from '../Config/prisma';

// Helper to seed initial hackathons if none exist
const seedInitialHackathons = async () => {
  const count = await prisma.hackathon.count();
  if (count > 0) return;

  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  await prisma.hackathon.createMany({
    data: [
      {
        title: 'HackAI 2026',
        description: 'Build the next generation of AI agents, tools, and productivity applications using large language models. Win prizes, find sponsors, and launch your agent startup.',
        type: 'Online',
        duration: '3 Days',
        location: 'Virtual',
        startDate: now,
        endDate: threeDaysLater,
      },
      {
        title: 'Mergeathon Delhi',
        description: 'A local developers meetup and overnight hackathon focused on building developer tooling, open source contributions, and collaborative React/Node frameworks.',
        type: 'Local',
        duration: '2 Days',
        location: 'Delhi, India',
        startDate: now,
        endDate: fiveDaysLater,
      },
      {
        title: 'MIT Web3 Genesis',
        description: 'Explore the boundaries of decentralized protocols, smart contracts, zero-knowledge proofs, and web3 social networks. An elite campus hackathon.',
        type: 'College',
        duration: '3 Days',
        location: 'Cambridge, MA',
        startDate: now,
        endDate: tenDaysLater,
      }
    ]
  });
};

// Calculate skill-based team matching percentage
const calculateMatchPercentage = (userSkills: string[], teamLookingFor: string[]): number => {
  if (!teamLookingFor || teamLookingFor.length === 0) return 75; // base default matching percentage

  const userSkillsLower = userSkills.map(s => s.toLowerCase());
  const lookingForLower = teamLookingFor.map(s => s.toLowerCase());

  const matches = userSkillsLower.filter(skill => lookingForLower.includes(skill));
  const ratio = matches.length / lookingForLower.length;
  
  const percentage = Math.round(ratio * 100);
  // Return at least 15-30% randomized matching even if no skill matches, so the UI is active and recommendations feel alive
  if (percentage === 0) {
    return Math.floor(Math.random() * 20) + 15;
  }
  return percentage;
};

// Get all hackathons (auto-seeds if empty)
export const getHackathons = async (req: Request, res: Response): Promise<void> => {
  try {
    await seedInitialHackathons();

    const hackathons = await prisma.hackathon.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        teams: {
          include: {
            members: true
          }
        }
      }
    });

    res.status(200).json(hackathons);
  } catch (error) {
    console.error('Error fetching hackathons:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get single hackathon details and calculate recommended teams for user
export const getHackathonDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, avatar: true, skills: true } }
              }
            },
            requests: {
              include: {
                applicant: { select: { id: true, name: true, avatar: true, skills: true } }
              }
            }
          }
        }
      }
    });

    if (!hackathon) {
      res.status(404).json({ message: 'Hackathon not found' });
      return;
    }

    // Fetch requesting user's skills for recommendation calculation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { skills: true }
    });

    const userSkills = user?.skills || [];

    // Calculate match percentages for each team
    const teamsWithMatch = hackathon.teams.map(team => {
      const matchPct = calculateMatchPercentage(userSkills, team.lookingFor);
      return {
        ...team,
        matchPercentage: matchPct
      };
    });

    // Sort teams so recommended teams appear first
    teamsWithMatch.sort((a, b) => b.matchPercentage - a.matchPercentage);

    res.status(200).json({
      ...hackathon,
      teams: teamsWithMatch
    });
  } catch (error) {
    console.error('Error fetching hackathon details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create a new hackathon dynamically
export const createHackathon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, type, duration, location, startDate, endDate } = req.body;

    if (!title || !description || !type || !duration) {
      res.status(400).json({ message: 'Title, description, type, and duration are required.' });
      return;
    }

    const hackathon = await prisma.hackathon.create({
      data: {
        title,
        description,
        type,
        duration,
        location,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000)
      }
    });

    res.status(201).json(hackathon);
  } catch (error) {
    console.error('Error creating hackathon:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create a new hackathon team
export const createTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: hackathonId } = req.params;
    const { name, description, lookingFor } = req.body;
    const creatorId = (req as any).userId;

    if (!creatorId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!name || !description) {
      res.status(400).json({ message: 'Team Name and Description are required' });
      return;
    }

    // Check if team creator is already in a team for this hackathon
    const existingParticipation = await prisma.hackathonTeamMember.findFirst({
      where: {
        userId: creatorId,
        team: {
          hackathonId
        }
      }
    });

    if (existingParticipation) {
      res.status(400).json({ message: 'You have already joined or created a team in this hackathon.' });
      return;
    }

    const team = await prisma.hackathonTeam.create({
      data: {
        hackathonId,
        name,
        description,
        lookingFor: lookingFor || [],
        members: {
          create: {
            userId: creatorId,
            role: 'Creator'
          }
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      }
    });

    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating hackathon team:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Apply to join a hackathon team
export const applyToTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { message } = req.body;
    const applicantId = (req as any).userId;

    if (!applicantId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const team = await prisma.hackathonTeam.findUnique({
      where: { id: teamId },
      include: { hackathon: true }
    });

    if (!team) {
      res.status(404).json({ message: 'Team not found' });
      return;
    }

    // Ensure applicant is not already in a team for this hackathon
    const existingParticipation = await prisma.hackathonTeamMember.findFirst({
      where: {
        userId: applicantId,
        team: {
          hackathonId: team.hackathonId
        }
      }
    });

    if (existingParticipation) {
      res.status(400).json({ message: 'You are already in a team for this hackathon.' });
      return;
    }

    const existingRequest = await prisma.hackathonTeamJoinRequest.findUnique({
      where: {
        teamId_applicantId: {
          teamId,
          applicantId
        }
      }
    });

    if (existingRequest) {
      res.status(400).json({ message: 'You have already applied to this team.' });
      return;
    }

    const request = await prisma.hackathonTeamJoinRequest.create({
      data: {
        teamId,
        applicantId,
        message: message || 'I would love to build together!'
      },
      include: {
        applicant: { select: { name: true } },
        team: { select: { name: true, hackathonId: true } }
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Error applying to team:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Accept or reject a join request
export const handleJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId, requestId } = req.params;
    const { status } = req.body; // 'Accepted' or 'Rejected'
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const team = await prisma.hackathonTeam.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) {
      res.status(404).json({ message: 'Team not found' });
      return;
    }

    // Ensure the requester is the Team Creator
    const isCreator = team.members.some(m => m.userId === userId && m.role === 'Creator');
    if (!isCreator) {
      res.status(403).json({ message: 'Only team creators can accept or reject applications.' });
      return;
    }

    const request = await prisma.hackathonTeamJoinRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.teamId !== teamId) {
      res.status(404).json({ message: 'Application request not found.' });
      return;
    }

    if (status === 'Accepted') {
      // Check if user is already in a team for this hackathon
      const alreadyInTeam = await prisma.hackathonTeamMember.findFirst({
        where: {
          userId: request.applicantId,
          team: {
            hackathonId: team.hackathonId
          }
        }
      });

      if (alreadyInTeam) {
        // Automatically reject since applicant has joined another team
        await prisma.hackathonTeamJoinRequest.update({
          where: { id: requestId },
          data: { status: 'Rejected' }
        });
        res.status(400).json({ message: 'Applicant is already in a team for this hackathon. Application auto-rejected.' });
        return;
      }

      await prisma.$transaction([
        prisma.hackathonTeamJoinRequest.update({
          where: { id: requestId },
          data: { status: 'Accepted' }
        }),
        prisma.hackathonTeamMember.create({
          data: {
            teamId,
            userId: request.applicantId,
            role: 'Member'
          }
        })
      ]);
    } else {
      await prisma.hackathonTeamJoinRequest.update({
        where: { id: requestId },
        data: { status: 'Rejected' }
      });
    }

    res.status(200).json({ message: `Application ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Error handling join request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get team chat messages
export const getTeamMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Verify membership
    const member = await prisma.hackathonTeamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId }
      }
    });

    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team.' });
      return;
    }

    const messages = await prisma.hackathonTeamMessage.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching team messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Send team chat message and broadcast via Socket
export const sendTeamMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!content || content.trim() === '') {
      res.status(400).json({ message: 'Message content is required.' });
      return;
    }

    // Verify membership
    const member = await prisma.hackathonTeamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId }
      }
    });

    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team.' });
      return;
    }

    const message = await prisma.hackathonTeamMessage.create({
      data: {
        teamId,
        senderId: userId,
        content
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    // Realtime broadcast to Socket.io room
    const io = req.app.get('io');
    if (io) {
      io.to(`team_${teamId}`).emit('team_message_received', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending team message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
