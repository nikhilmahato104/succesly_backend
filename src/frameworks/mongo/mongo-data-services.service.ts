import { IDataServices }            from '../../core/abstracts/data-service.abstract';
import { IModuleDocument }           from '../../core/entities/module.entity';
import { IRoleDocument }             from '../../core/entities/role.entity';
import { IUserDocument }             from '../../core/entities/user.entity';
import { IApiKeyDocument }           from '../../core/entities/api-key.entity';
import { IProjectDocument }          from '../../core/entities/project.entity';
import { IActivityLogDocument }      from '../../core/entities/activity-log.entity';
import { IDeviceInfoDocument }       from '../../core/entities/device-info.entity';
import { ICampaignDocument }         from '../../core/entities/campaign.entity';
import { ICampaignClickDocument }    from '../../core/entities/campaign-click.entity';
import { IGenericRepository }        from '../../core/abstracts/generic-repository.abstract';
import { Module }                    from './model/module.model';
import { Role }                      from './model/role.model';
import { User }                      from './model/user.model';
import { ApiKey }                    from './model/api-key.model';
import { Project }                   from './model/project.model';
import { ActivityLog }               from './model/activity-log.model';
import { DeviceInfo }                from './model/device-info.model';
import { Campaign }                  from './model/campaign.model';
import { CampaignClick }             from './model/campaign-click.model';
import { MongoGenericRepository }    from './mongo-generic-repository';

export class MongoDataServices implements IDataServices {
  modules:        IGenericRepository<IModuleDocument>;
  roles:          IGenericRepository<IRoleDocument>;
  users:          IGenericRepository<IUserDocument>;
  apiKeys:        IGenericRepository<IApiKeyDocument>;
  projects:       IGenericRepository<IProjectDocument>;
  activityLogs:   IGenericRepository<IActivityLogDocument>;
  deviceInfos:    IGenericRepository<IDeviceInfoDocument>;
  campaigns:      IGenericRepository<ICampaignDocument>;
  campaignClicks: IGenericRepository<ICampaignClickDocument>;

  constructor() {
    this.modules        = new MongoGenericRepository<IModuleDocument>(Module);
    this.roles          = new MongoGenericRepository<IRoleDocument>(Role);
    this.users          = new MongoGenericRepository<IUserDocument>(User);
    this.apiKeys        = new MongoGenericRepository<IApiKeyDocument>(ApiKey);
    this.projects       = new MongoGenericRepository<IProjectDocument>(Project);
    this.activityLogs   = new MongoGenericRepository<IActivityLogDocument>(ActivityLog);
    this.deviceInfos    = new MongoGenericRepository<IDeviceInfoDocument>(DeviceInfo);
    this.campaigns      = new MongoGenericRepository<ICampaignDocument>(Campaign);
    this.campaignClicks = new MongoGenericRepository<ICampaignClickDocument>(CampaignClick);
  }
}
