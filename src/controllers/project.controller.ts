import { Request, Response } from 'express';
import prisma from '../Config/prisma';

// Create a new project
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, techStack, lookingFor, projectType, teamSize, location } = req.body;
    const ownerId = (req as any).userId;

    if (!ownerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!title || !description) {
      res.status(400).json({ message: 'Title and description are required' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        title,
        description,
        techStack: techStack || [],
        lookingFor: lookingFor || [],
        projectType,
        teamSize: teamSize ? parseInt(teamSize) : null,
        location,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'Owner'
          }
        }
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      }
    });

    // Create an auto-post about the new project
    await prisma.post.create({
      data: {
        content: `Launched a new project: ${title} 🚀`,
        postType: 'Auto',
        authorId: ownerId,
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all projects for browse
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, avatar: true, skills: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      }
    });

    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get single project details
export const getProjectDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatar: true, skills: true, bio: true } },
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
    });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    res.status(200).json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Apply to join project
export const applyToProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { message } = req.body;
    const applicantId = (req as any).userId;

    if (!applicantId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const existingRequest = await prisma.projectJoinRequest.findUnique({
      where: {
        projectId_applicantId: {
          projectId: projectId as string,
          applicantId
        }
      }
    });

    if (existingRequest) {
      res.status(400).json({ message: 'You have already applied to this project' });
      return;
    }
    
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: projectId as string,
          userId: applicantId
        }
      }
    });
    
    if (existingMember) {
      res.status(400).json({ message: 'You are already a member of this project' });
      return;
    }

    const request = await prisma.projectJoinRequest.create({
      data: {
        projectId: projectId as string,
        applicantId,
        message: message || "I'd like to join your project."
      },
      include: {
        applicant: { select: { name: true } },
        project: { select: { title: true, ownerId: true } }
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(request.project.ownerId).emit('project_application_received', {
        id: request.id,
        projectId: request.projectId,
        projectTitle: request.project.title,
        applicantName: request.applicant.name,
        message: request.message,
        status: request.status
      });
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error applying to project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Handle application (accept/reject)
export const handleApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, appId } = req.params;
    const { status } = req.body; // 'Accepted' or 'Rejected'
    const ownerId = (req as any).userId;

    if (!ownerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== ownerId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const request = await prisma.projectJoinRequest.findUnique({
      where: { id: appId }
    });

    if (!request) {
      res.status(404).json({ message: 'Application not found' });
      return;
    }

    if (status === 'Accepted') {
      // Add as member
      await prisma.$transaction([
        prisma.projectJoinRequest.update({
          where: { id: appId },
          data: { status: 'Accepted' }
        }),
        prisma.projectMember.create({
          data: {
            projectId: projectId as string,
            userId: request.applicantId,
            role: 'Member'
          }
        }),
        // Create an auto-post about user joining project
        prisma.post.create({
          data: {
            content: `Joined the project ${project.title} as a Member! ✨`,
            postType: 'Auto',
            authorId: request.applicantId,
          }
        })
      ]);
    } else {
      await prisma.projectJoinRequest.update({
        where: { id: appId },
        data: { status: 'Rejected' }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(request.applicantId).emit('project_application_handled', {
        projectId,
        projectTitle: project.title,
        status
      });
    }

    res.status(200).json({ message: `Application ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Error handling application:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get project chat messages
export const getProjectMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Ensure user is a member
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: projectId as string, userId }
      }
    });

    if (!member) {
      res.status(403).json({ message: 'You are not a member of this project' });
      return;
    }

    const messages = await prisma.projectMessage.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching project messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Send project chat message
export const sendProjectMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!content) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }

    // Ensure user is a member
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: projectId as string, userId }
      }
    });

    if (!member) {
      res.status(403).json({ message: 'You are not a member of this project' });
      return;
    }

    const message = await prisma.projectMessage.create({
      data: {
        projectId: projectId as string,
        senderId: userId,
        content
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending project message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
